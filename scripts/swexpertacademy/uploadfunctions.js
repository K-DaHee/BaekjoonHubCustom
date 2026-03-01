/**
 * prompt 표시 전에 기존 PR에 동일한 코드가 이미 있는지 확인
 * @param {object} bojData - 문제 풀이와 관련된 데이터 객체
 * @returns {Promise<{isDuplicate: boolean, prUrl?: string}>}
 */
async function checkDuplicateInPR(bojData) {
  try {
    const token = await getToken();
    const hook = await getHook();
    if (isNull(token) || isNull(hook)) {
      return { isDuplicate: false };
    }

    const git = new GitHub(hook, token);
    const stats = await getStats();
    let baseBranch = stats.branches[hook] || await git.getDefaultBranchOnRepo();

    // 커밋 메시지에서 플랫폼 정보 추출
    const platform = bojData.message.substring(bojData.message.indexOf('/') + 1, bojData.message.indexOf(']'));
    const branchName = `${platform}/problem-${bojData.fileName.replace(/[^0-9]/g, '')}`;

    // 기존 열린 PR 확인
    const owner = hook.split('/')[0];
    const existingPR = await findExistingPR(git, owner, branchName);

    if (!existingPR) {
      return { isDuplicate: false };
    }

    // 기존 브랜치의 트리에서 동일 코드 확인
    const { refSHA: branchHeadSHA } = await git.getReference(branchName);
    const { treeSHA: branchTreeSHA } = await git.getCommit(branchHeadSHA);
    const treeItems = await git.getTreeRecursive(branchTreeSHA);
    const existingFilesInDir = treeItems.filter(item =>
      item.path.startsWith(bojData.directory + '/') && item.type === 'blob'
    );

    const newCodeSHA = calculateBlobSHA(bojData.code);
    let isDuplicate = existingFilesInDir.some(file => file.sha === newCodeSHA);

    // Java 파일의 경우 클래스명이 넘버링되어 변경될 수 있으므로 추가 비교
    if (!isDuplicate) {
      const ext = bojData.fileName.split('.').pop();
      if (ext === 'java') {
        isDuplicate = existingFilesInDir.some(file => {
          const fileName = file.path.split('/').pop();
          if (!fileName.endsWith('.java')) return false;
          const className = fileName.replace('.java', '');
          const renamedCode = bojData.code.replace(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/, `public class ${className}`);
          return file.sha === calculateBlobSHA(renamedCode);
        });
      }
    }

    if (isDuplicate) {
      return { isDuplicate: true, prUrl: existingPR.html_url };
    }

    return { isDuplicate: false };
  } catch (e) {
    console.log('PR 중복 체크 중 에러 (무시하고 계속 진행):', e);
    return { isDuplicate: false };
  }
}

/**
 * Github에 풀 리퀘스트 생성하여 문제 풀이 코드 업로드
 * - 기존 PR이 있으면 커밋 추가 + PR body append
 * - 동일 코드가 이미 PR에 있으면 스킵
 * - 다른 코드면 넘버링된 파일명으로 업로드
 * @param {object} bojData - 문제 풀이와 관련된 데이터 객체
 * @param {function} cb - 업로드 완료 후 실행될 콜백 함수
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }

  const git = new GitHub(hook, token);
  const stats = await getStats();
  let baseBranch = stats.branches[hook] || await git.getDefaultBranchOnRepo();
  stats.branches[hook] = baseBranch;

  // 커밋 메시지에서 플랫폼 정보 추출
  const platform = bojData.message.substring(bojData.message.indexOf('/') + 1, bojData.message.indexOf(']'));
  const branchName = `${platform}/problem-${bojData.fileName.replace(/[^0-9]/g, '')}`;

  // 기존 열린 PR 확인
  const owner = hook.split('/')[0];
  const existingPR = await findExistingPR(git, owner, branchName);

  if (existingPR) {
    // 기존 PR이 있는 경우: 중복 체크 후 커밋 추가
    await handleExistingPR(git, hook, token, existingPR, branchName, bojData, cb);
  } else {
    // 기존 PR이 없는 경우: 새 브랜치 + 새 PR 생성 (기존 로직)
    await handleNewPR(git, hook, token, baseBranch, branchName, bojData, cb);
  }
}

/**
 * 해당 브랜치에 열린 PR이 있는지 확인
 * @returns {object|null} 기존 PR 객체 또는 null
 */
async function findExistingPR(git, owner, branchName) {
  try {
    const prs = await git.listPullRequests('open', `${owner}:${branchName}`);
    if (Array.isArray(prs) && prs.length > 0) {
      console.log(`기존 PR을 발견했습니다: #${prs[0].number} - ${prs[0].title}`);
      return prs[0];
    }
  } catch (e) {
    console.log('기존 PR 조회 중 에러 (무시하고 새 PR 생성):', e);
  }
  return null;
}

/**
 * 기존 PR이 있는 경우: 중복 체크 → 커밋 추가 → PR body append
 */
async function handleExistingPR(git, hook, token, existingPR, branchName, bojData, cb) {
  const branchRef = `refs/heads/${branchName}`;

  // 1. 기존 브랜치의 HEAD SHA와 트리 SHA 가져오기
  const { refSHA: branchHeadSHA } = await git.getReference(branchName);
  const { treeSHA: branchTreeSHA } = await git.getCommit(branchHeadSHA);

  // 2. 기존 트리에서 같은 디렉토리의 파일 목록 가져오기
  const treeItems = await git.getTreeRecursive(branchTreeSHA);
  const existingFilesInDir = treeItems.filter(item =>
    item.path.startsWith(bojData.directory + '/') && item.type === 'blob'
  );

  // 3. 새 코드의 Blob SHA 계산 (GitHub 방식)
  const newCodeSHA = calculateBlobSHA(bojData.code);

  // 4. 기존 파일들과 SHA 비교 → 동일 코드 감지
  const isDuplicate = existingFilesInDir.some(file => file.sha === newCodeSHA);
  if (isDuplicate) {
    console.log('기존 PR에 이미 동일한 코드가 존재합니다. 업로드를 스킵합니다.');
    Toast.raiseToast('이미 동일한 코드가 PR에 존재합니다.');
    if (typeof cb === 'function') {
      cb(existingPR.html_url);
    }
    return;
  }

  // 5. 파일명 넘버링: 기존 파일들을 확인하여 다음 번호 결정
  const numberedFileName = getNextFileName(existingFilesInDir, bojData.directory, bojData.fileName);

  // 6. Java 파일인 경우 클래스명도 넘버링된 파일명과 일치시키기
  let finalCode = bojData.code;
  const ext = numberedFileName.split('.').pop();
  if (ext === 'java' && numberedFileName !== bojData.fileName) {
    const newClassName = numberedFileName.replace(`.${ext}`, '');
    finalCode = finalCode.replace(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/, `public class ${newClassName}`);
  }

  // 7. 기존 브랜치에 새 커밋 추가
  const source = await git.createBlob(finalCode, `${bojData.directory}/${numberedFileName}`);
  const newTreeSHA = await git.createTree(branchTreeSHA, [source]);
  const commitSHA = await git.createCommit(bojData.message, newTreeSHA, branchHeadSHA);
  await git.updateHead(branchRef, commitSHA);

  console.log(`성공: 기존 브랜치 '${branchName}'에 커밋이 추가되었습니다. (파일: ${numberedFileName})`);

  // 8. PR body에 새 풀이 정보 append
  const appendBody = makeAppendPRBody(bojData);
  const updatedBody = existingPR.body + appendBody;
  await git.updatePullRequest(existingPR.number, updatedBody);

  console.log(`PR #${existingPR.number}의 body가 업데이트되었습니다.`);

  if (typeof cb === 'function') {
    cb(existingPR.html_url);
  }
}

/**
 * 새 PR 생성 (기존 로직)
 */
async function handleNewPR(git, hook, token, baseBranch, branchName, bojData, cb) {
  const branchRef = `refs/heads/${branchName}`;

  // 베이스 브랜치의 최신 커밋 SHA와 트리 SHA
  const { refSHA: baseBranchSHA } = await git.getReference(baseBranch);
  const { treeSHA: baseTreeSHA } = await git.getCommit(baseBranchSHA);

  // 새 브랜치 생성
  await git.createReference(branchRef, baseBranchSHA);

  // 파일 Blob 생성 및 새 Tree 생성
  const source = await git.createBlob(bojData.code, `${bojData.directory}/${bojData.fileName}`);
  const newTreeSHA = await git.createTree(baseTreeSHA, [source]);

  // 새 커밋 생성 및 브랜치 Head 업데이트
  const commitSHA = await git.createCommit(bojData.message, newTreeSHA, baseBranchSHA);
  await git.updateHead(branchRef, commitSHA);

  console.log(`성공: '${branchName}' 브랜치에 커밋이 완료되었습니다.`);

  // PR 생성
  const stats = await getStats();
  const prTitle = bojData.message;
  const pullRequest = await git.createPullRequest(prTitle, bojData.prBody, branchName, baseBranch);
  console.log(`Pull Request가 성공적으로 생성되었습니다: ${pullRequest.html_url}`);

  if (typeof cb === 'function') {
    cb(pullRequest.html_url);
  }
}

/**
 * 기존 파일 목록을 확인하여 넘버링된 파일명 생성
 * @param {Array} existingFiles - 트리에 존재하는 파일 목록
 * @param {string} directory - 파일 디렉토리
 * @param {string} baseFileName - 기본 파일명
 * @returns {string} 사용할 파일명
 */
function getNextFileName(existingFiles, directory, baseFileName) {
  const dotIndex = baseFileName.lastIndexOf('.');
  const nameWithoutExt = baseFileName.substring(0, dotIndex);
  const extension = baseFileName.substring(dotIndex);

  const existingNames = existingFiles.map(f => {
    const parts = f.path.split('/');
    return parts[parts.length - 1];
  });

  if (!existingNames.includes(baseFileName)) {
    return baseFileName;
  }

  let counter = 2;
  let candidateName = `${nameWithoutExt}_${counter}${extension}`;
  while (existingNames.includes(candidateName)) {
    counter++;
    candidateName = `${nameWithoutExt}_${counter}${extension}`;
  }

  return candidateName;
}

/**
 * 기존 PR body에 append할 추가 풀이 섹션 생성
 * @param {object} bojData - 문제 풀이 데이터
 * @returns {string} append할 PR body 섹션
 */
function makeAppendPRBody(bojData) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const approachMatch = bojData.prBody.match(/## 🤔 접근 방법\s*\n([\s\S]*?)(?=\n\s*##|\s*$)/);
  const difficultyMatch = bojData.prBody.match(/## 🤯 어려웠던 점\s*\n([\s\S]*?)(?=\n\s*##|\s*$)/);
  const learnedMatch = bojData.prBody.match(/## 📚 배운 점\s*\n([\s\S]*?)(?=\n\s*##|\s*$)/);

  const approach = approachMatch ? approachMatch[1].trim() : '';
  const difficulty = difficultyMatch ? difficultyMatch[1].trim() : '';
  const learned = learnedMatch ? learnedMatch[1].trim() : '';

  const memoryMatch = bojData.prBody.match(/### 메모리\s*\n\s*(.*)/);
  const runtimeMatch = bojData.prBody.match(/### 시간\s*\n\s*(.*)/);
  const memory = memoryMatch ? memoryMatch[1].trim() : '';
  const runtime = runtimeMatch ? runtimeMatch[1].trim() : '';

  return `

  ---
  ## 📝 추가 풀이 (${dateStr})
  ### ⏱️ 성능 요약
  - **메모리:** ${memory}
  - **시간:** ${runtime}

  ### 🤔 접근 방법
  ${approach}

  ### 🤯 어려웠던 점
  ${difficulty}

  ### 📚 배운 점
  ${learned}
  `;
}