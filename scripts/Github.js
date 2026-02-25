class GitHub {
  constructor(hook, token) {
    log('GitHub constructor', hook, token);
    this.update(hook, token);
  }

  update(hook, token) {
    this.hook = hook;
    this.token = token;
  }

  async getReference(branch = 'main') {
    // hook, token, branch
    return getReference(this.hook, this.token, branch);
  }

  async getDefaultBranchOnRepo() {
    return getDefaultBranchOnRepo(this.hook, this.token);
  }

  async createBlob(content, path) {
    // hook, token, content, path
    return createBlob(this.hook, this.token, content, path);
  }

  async createTree(refSHA, tree_items) {
    // hook, token, baseSHA, tree_items
    log('GitHub createTree', 'refSHA:', refSHA, 'tree_items:', tree_items);
    return createTree(this.hook, this.token, refSHA, tree_items);
  }

  async createCommit(message, treeSHA, refSHA) {
    // hook, token, message, tree, parent
    log('GitHub createCommit', 'message:', message, 'treeSHA:', treeSHA, 'refSHA:', refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(ref, commitSHA) {
    // hook, token, commitSHA, force = true)
    log('GitHub updateHead', 'ref:', ref, 'commitSHA:', commitSHA);
    return updateHead(this.hook, this.token, ref, commitSHA, true);
  }

  // ==================== [START] 추가할 코드 ====================
  async createReference(ref, sha) {
    log('GitHub createReference', 'ref:', ref, 'sha:', sha);
    return createReference(this.hook, this.token, ref, sha);
  }

  async createPullRequest(title, body, head, base) {
    log('GitHub createPullRequest', 'title:', title, 'head:', head, 'base:', base);
    return createPullRequest(this.hook, this.token, title, body, head, base);
  }

  async getCommit(sha) {
    log('GitHub getCommit', 'sha:', sha);
    return getCommit(this.hook, this.token, sha);
  }

  async listPullRequests(state, head) {
    log('GitHub listPullRequests', 'state:', state, 'head:', head);
    return listPullRequests(this.hook, this.token, state, head);
  }

  async updatePullRequest(pullNumber, body) {
    log('GitHub updatePullRequest', 'pullNumber:', pullNumber);
    return updatePullRequest(this.hook, this.token, pullNumber, body);
  }

  async getTreeRecursive(treeSHA) {
    log('GitHub getTreeRecursive', 'treeSHA:', treeSHA);
    return getTreeRecursive(this.hook, this.token, treeSHA);
  }
  // ===================== [END] 추가할 코드 =====================

  async getTree() {
    // hook, token
    return getTree(this.hook, this.token);
  }
}

/** get a repo default branch
 * @see https://docs.github.com/en/rest/reference/repos
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the branch sha
 */
async function getDefaultBranchOnRepo(hook, token) {
  return fetch(`https://api.github.com/repos/${hook}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.default_branch;
    });
}

/** get a reference
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 * @param {string} hook - github repository
 * @param {string} token - reference name
 * @param {string} ref - reference name
 * @return {Promise} - the promise for the reference sha
 */
async function getReference(hook, token, branch = 'main') {
  // return fetch(`https://api.github.com/repos/${hook}/git/refs`, {
  return fetch(`https://api.github.com/repos/${hook}/git/refs/heads/${branch}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return { refSHA: data.object.sha, ref: data.ref };
      // return { refSHA: data[0].object.sha, ref: data[0].ref };
    });
}
/** create a Blob
 * @see https://docs.github.com/en/rest/reference/git#create-a-blob
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} content - the content on base64 to add the repository
 * @param {string} path - the path to add the repository
 * @return {Promise} - the promise for the tree_item object
 */
async function createBlob(hook, token, content, path) {
  return fetch(`https://api.github.com/repos/${hook}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: b64EncodeUnicode(content), encoding: 'base64' }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return { path, sha: data.sha, mode: '100644', type: 'blob' };
    });
}

/** create a new tree in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {object} tree_items - the tree items
 * @param {string} refSHA - the root sha of the tree
 * @return {Promise} - the promise for the tree sha
 */
async function createTree(hook, token, refSHA, tree_items) {
  return fetch(`https://api.github.com/repos/${hook}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: tree_items, base_tree: refSHA }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** create a commit in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-commit
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} message - the commit message
 * @param {string} treeSHA - the tree sha
 * @param {string} refSHA - the parent sha
 * @return {Promise} - the promise for the commit sha
 */
async function createCommit(hook, token, message, treeSHA, refSHA) {
  return fetch(`https://api.github.com/repos/${hook}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** update a ref
 * @see https://docs.github.com/en/rest/reference/git#update-a-reference
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} ref - the ref to update
 * @param {string} commitSHA - the commit sha
 * @param {boolean} force - force update
 * @return {Promise} - the promise for the http request
 */
async function updateHead(hook, token, ref, commitSHA, force = true) {
  return fetch(`https://api.github.com/repos/${hook}/git/${ref}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the tree items
 */
async function getTree(hook, token) {
  return fetch(`https://api.github.com/repos/${hook}/git/trees/HEAD?recursive=1`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.tree;
    });
}

/**
 * create a reference
 * @see https://docs.github.com/en/rest/git/refs#create-a-reference
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} ref - the reference name (e.g., "refs/heads/branch_name")
 * @param {string} sha - the SHA1 value for this reference
 * @return {Promise} - the promise for the reference object
 */
async function createReference(hook, token, ref, sha) {
  return fetch(`https://api.github.com/repos/${hook}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref, sha }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  }).then((res) => res.json());
}

/**
 * create a pull request
 * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} title - the title of the pull request
 * @param {string} body - the contents of the pull request
 * @param {string} head - the name of the branch where your changes are implemented
 * @param {string} base - the name of the branch you want the changes pulled into
 * @return {Promise} - the promise for the pull request object
 */
async function createPullRequest(hook, token, title, body, head, base) {
  return fetch(`https://api.github.com/repos/${hook}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head, base, body }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      // PR 생성 실패 시 에러를 더 명확하게 보여줍니다.
      if (data.errors) {
        throw new Error(`PR 생성 실패: ${JSON.stringify(data.errors)}`);
      }
      return data;
    });
}

/**
 * get a commit
 * @see https://docs.github.com/en/rest/git/commits#get-a-commit-object
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} commit_sha - the commit sha
 * @return {Promise} - the promise for the commit object
 */
async function getCommit(hook, token, commit_sha) {
  return fetch(`https://api.github.com/repos/${hook}/git/commits/${commit_sha}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  .then((res) => res.json())
  .then((data) => {
    return { treeSHA: data.tree.sha };
  });
}

/**
 * list pull requests for a repository
 * @see https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} state - PR state ('open', 'closed', 'all')
 * @param {string} head - filter by head branch (format: 'owner:branch')
 * @return {Promise<Array>} - the promise for the pull request list
 */
async function listPullRequests(hook, token, state, head) {
  const params = new URLSearchParams({ state });
  if (head) params.append('head', head);
  return fetch(`https://api.github.com/repos/${hook}/pulls?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  }).then((res) => res.json());
}

/**
 * update a pull request (e.g., update body)
 * @see https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {number} pullNumber - the pull request number
 * @param {string} body - the new body content
 * @return {Promise} - the promise for the updated pull request object
 */
async function updatePullRequest(hook, token, pullNumber, body) {
  return fetch(`https://api.github.com/repos/${hook}/pulls/${pullNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  }).then((res) => res.json());
}

/**
 * get a tree recursively by tree SHA
 * @see https://docs.github.com/en/rest/git/trees#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} treeSHA - the tree SHA to retrieve
 * @return {Promise<Array>} - the promise for the tree items
 */
async function getTreeRecursive(hook, token, treeSHA) {
  return fetch(`https://api.github.com/repos/${hook}/git/trees/${treeSHA}?recursive=1`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.tree || [];
    });
}