module.exports = (NodeGit, MergeUtils) => ({
  merge(toBranch, fromBranch, repo, processMergeMessageCallback = a => a, signingCallback, signatureField = 'gpgsig') {
    return Promise.resolve()
      .then(() => {
        if (!toBranch.isHead()) {
          return repo.checkoutBranch(toBranch);
        }
        return Promise.resolve();
      })
      .then(() => NodeGit.AnnotatedCommit.fromRef(repo, fromBranch))
      .then((fromCommit) => {
        const checkoutOpts = {
          checkoutStrategy: NodeGit.Checkout.STRATEGY.SAFE | NodeGit.Checkout.STRATEGY.RECREATE_MISSING
        };
        return NodeGit.Merge.merge(repo, fromCommit, null, checkoutOpts);
      })
      .then(() => repo.index())
      .then((index) => {
        if (index.hasConflicts && index.hasConflicts()) {
          return Promise.reject(index);
        }

        return index.writeTree();
      })
      .then((treeOid) => Promise.all([
        treeOid,
        processMergeMessageCallback(MergeUtils.getMergeMessage(toBranch, fromBranch)),
        repo.defaultSignature(),
        repo.getHeadCommit(),
        repo.getBranchCommit('MERGE_HEAD')
      ]))
      .then(([treeOid, message, signature, ...commits]) => signingCallback
        ? repo.createCommitWithSignature('HEAD', signature, signature, message, treeOid, commits, signatureField, signingCallback)
        : repo.createCommit('HEAD', signature, signature, message, treeOid, commits)
      )
      .then((commitId) => {
        repo.stateCleanup();

        return commitId;
      });
  },

  rebase(toBranch, fromBranch, repo, beforeRebaseFinish) {
    return repo.rebaseBranches(
      fromBranch.name(),
      toBranch.name(),
      undefined,
      undefined,
      undefined,
      beforeRebaseFinish
    )
      .then((result) => {
        if (result.hasConflicts && result.hasConflicts()) {
          return Promise.reject(result);
        }

        return toBranch.setTarget(result, '');
      });
  }
});
