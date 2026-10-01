// Offline classroom access gate, not server-side authentication.
// Digests avoid storing plaintext passwords, but the downloadable game can be modified.
const ACCOUNTS = Object.freeze({
  user01: '590c019bc9c8ea2dff64a50c55b8010907396f5a76fa1e680e0e5682a3f6de2d',
  user02: 'acd8a5b5f624b832c423a72a0c46b137f57250e6b3552ef906ffd377a37a440b',
  user03: '9891080e56e4e5c1d0e256f945467daa4909974068c204d6544a9b1b01a67c10',
  user04: '4f49cc41d67ee450bd3f50e17efc2bca04e9fa04aa6d1b0ccd7fecd36abe3bb9',
  user05: 'ebc2c9a0284286ec9978930f8c707a7f633ae0e6404c82eec2978b981f375f19',
  user06: '44b117c49a3d8b1eed722fed21116ffac7666f0d4d35993ac218060f81fc0437',
  user07: '833ce9c41c79000a2c2538b46bf5bdab47da48d5d12b93d07d0927f4851cb720',
  user08: '0c0ee84bacd89f1083f904f7cc3d3d74fea19f7ed7ccaa4559ae6d4ec7e66fed',
  user09: '8f2f01cb63c83336ac636e8cc49a58b4051708dd8c7a3c42787e9bf3aef05754',
  user10: '1cfcd7d75718814489a5b904ca3d5ae7be87031ecc335f4343fed899c4c724c9',
  user11: 'c85be58af76dd8f52f9e8e8a35f82565e96705268f93c8ae675b4fda2bde10c6',
  user12: 'a83ef7e12183564ddee33e9b696a78f922cd813412cfa69c74c1643d32c35ded',
  user13: '51e6b8f3745da5ab78d9c71394b25c774e1bc3b08986e545df9eac88e5d9d4be',
  user14: '6d6b4af490bee20c64708e32424606472122deb65a4d241d8d219c1884e4ed7c',
  user15: '0c6a4772fee9617027b736e7d74e10f7f63fd75e303d0839c49e29fab8170995',
  user16: '4d2e96ac98b0550c2da1d68d3133edcca6900d3f25e612673313ac73df4906dc',
  user17: 'e62f165a1cf2cc4896f3d0540e90c852a4653255396ea7e4f0a1d9ebf84f3406',
  user18: 'a75e7778ca34f2b6696890ec6ac7a1be1a233f5c746fee62ddb73390939878f8',
  user19: '3cc87498738bdc5eb0a9c5a21bfe357be8160c1254ac82acace7e04200814e50',
  user20: '4cac11858059bc244227c07786551fa34d975b468c1336f22f671afac7701a9f',
});
const SESSION_KEY = 'neura-island-user-v1';
let currentUser = null;
const isAccount = (user) => Object.prototype.hasOwnProperty.call(ACCOUNTS, user);

export function getUser() {
  return currentUser;
}

export function restoreSession() {
  try {
    const user = sessionStorage.getItem(SESSION_KEY);
    currentUser = isAccount(user) ? user : null;
  } catch {
    currentUser = null;
  }
  return currentUser;
}

export async function login(username, password) {
  const user = username.trim().toLowerCase();
  if (!isAccount(user)) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user + ':' + password));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== ACCOUNTS[user]) return false;
  currentUser = user;
  try {
    sessionStorage.setItem(SESSION_KEY, user);
  } catch {
    // With storage blocked, login works until the page is reloaded.
  }
  return true;
}

export function logout() {
  currentUser = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be blocked.
  }
}
