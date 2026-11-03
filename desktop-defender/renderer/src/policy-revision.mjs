export function createPolicyRevision() {
  let revision = 0;
  return {
    capture: () => revision,
    edit: () => {
      revision += 1;
    },
    isCurrent: (submittedRevision) => revision === submittedRevision
  };
}
