const noop = () => {};
const noopSub = () => ({ remove: noop });

export const setNotificationHandler = noop;
export const addNotificationReceivedListener = noopSub;
export const addNotificationResponseReceivedListener = noopSub;
export const requestPermissionsAsync = () => Promise.resolve({ status: 'denied' });
export const getExpoPushTokenAsync = () => Promise.resolve({ data: null });
