export const pickTriggerData = ({change, keys}) => {
  const afterData = change.after?.data() || {};
  const beforeData = change.before?.data() || {};
  return keys.reduce((acc, key) => {
    acc[key] = afterData[key] ?? beforeData[key] ?? null;
    return acc;
  }, {});
};
