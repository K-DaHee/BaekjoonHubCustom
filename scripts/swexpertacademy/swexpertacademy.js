// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;

// SWEA 연습 문제 주소임을 확인하고, 맞는 파서를 실행
if (currentUrl.includes('/main/solvingProblem/solvingProblem.do') && document.querySelector('header > h1 > span').textContent === '모의 테스트') startLoader();
else if (currentUrl.includes('/main/code/problem/problemSolver.do') && currentUrl.includes('extension=BaekjoonHub')) parseAndUpload();

function parseAndUpload() {
  //async wrapper
  (async () => {
    const bojData = await parseData();
    await beginUpload(bojData);
  })();
}
function startLoader() {
  loader = setInterval(async () => {
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) stopLoader();
    // 제출 후 채점하기 결과가 성공적으로 나왔다면 코드를 파싱하고,
    // 결과 페이지로 안내한다.
    else if (getSolvedResult().includes('pass입니다')) {
      log('정답이 나왔습니다. 코드를 파싱합니다');
      stopLoader();
      try {
        const { contestProbId } = await parseCode();
        // prettier-ignore
        await makeSubmitButton(`${window.location.origin}`
          + `/main/code/problem/problemSolver.do?`
          + `contestProbId=${contestProbId}&`
          + `nickName=${getNickname()}&`
          + `extension=BaekjoonHub`);
      } catch (error) {
        log(error);
      }
    }
  }, 2000);
}

function getSolvedResult() {
  return document.querySelector('div.popup_layer.show > div > p.txt')?.innerText.trim().toLowerCase() || '';
}

function stopLoader() {
  clearInterval(loader);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  log('bojData', bojData);
  startUpload();
  if (isNotEmpty(bojData)) {

    // PR 중복 체크를 prompt 전에 수행
    const dupResult = await checkDuplicateInPR(bojData);
    if (dupResult.isDuplicate) {
      markUploadedCSS(dupResult.prUrl);
      console.log('기존 PR에 이미 동일한 코드가 존재합니다. 업로드를 스킵합니다.');
      return;
    }

    /* prBody 입력 받은 값으로 교체 */
    // 사용자가 입력 취소하면 기본값('작성된 내용이 없습니다.')으로 변경
    // 프롬프트로 사용자에게 직접 알고리즘 유형 입력받기
    const algorithmInput = prompt("알고리즘 분류를 입력하세요.\n(예: DFS, DP, 구현)", "");
    let algorithm;
    if (algorithmInput === '-') {
      algorithm = '';
    } else if (algorithmInput === null || algorithmInput.trim() === '') {
      algorithm = '작성된 내용이 없습니다.';
    } else {
      algorithm = algorithmInput;
    }
    bojData.prBody = bojData.prBody.replace('#알고리즘유형#', algorithm);

    // 접근 방법 입력받기
    const approachInput = prompt("어떻게 접근했나요?");
    let approach;
    if (approachInput === '-') {
      approach = '';
    } else if (approachInput === null || approachInput.trim() === '') {
      approach = '작성된 내용이 없습니다.';
    } else {
      approach = approachInput.replace(/\.\s+/g, '.  \n');
    }
    bojData.prBody = bojData.prBody.replace('#접근방법#', approach);

    // 어려웠던 점 입력받기
    const difficultInput = prompt("어떤 점이 어려웠나요?");
    let difficultPoints;
    if (difficultInput === '-') {
      difficultPoints = '';
    } else if (difficultInput === null || difficultInput.trim() === '') {
      difficultPoints = '작성된 내용이 없습니다.';
    } else {
      difficultPoints = difficultInput.replace(/\.\s+/g, '.  \n');
    }
    bojData.prBody = bojData.prBody.replace('#어려웠던점#', difficultPoints);

    // 배운 점 입력받기
    const learnedInput = prompt("무엇을 배웠나요?");
    let learnedPoints;
    if (learnedInput === '-') {
      learnedPoints = '';
    } else if (learnedInput === null || learnedInput.trim() === '') {
      learnedPoints = '작성된 내용이 없습니다.';
    } else {
      learnedPoints = learnedInput.replace(/\.\s+/g, '.  \n');
    }
    bojData.prBody = bojData.prBody.replace('#배운점#', learnedPoints);


    const stats = await getStats();
    const hook = await getHook();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`)
    calcSHA = calculateBlobSHA(bojData.code)
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA)
    if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. problemIdID ${bojData.problemId}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
  }
}

async function versionUpdate() {
  log('start versionUpdate');
  const stats = await updateLocalStorageStats();
  // update version.
  stats.version = getVersion();
  await saveStats(stats);
  log('stats updated.', stats);
}
