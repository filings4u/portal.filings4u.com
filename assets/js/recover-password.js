(() => {
'use strict';
const db=window.filings4uClientSupabase;
const $=id=>document.getElementById(id);
let ready=false,saving=false;
function message(text,type='error'){
  const el=$('message');if(!el)return;
  el.textContent=text;el.className='message '+type;el.hidden=false;
}
async function verifyRecoveryLink(){
  if(!db?.auth)throw new Error('Secure account service failed to load.');
  const url=new URL(location.href);
  const params=url.searchParams;
  const tokenHash=params.get('token_hash');
  const type=params.get('type') || new URLSearchParams(url.hash.replace(/^#/, '')).get('type');
  const code=params.get('code');
  const hash=new URLSearchParams(url.hash.replace(/^#/, ''));
  const hasHashTokens=!!(hash.get('access_token')&&hash.get('refresh_token'));
  if(type&&type!=='recovery')throw new Error('This is not a password recovery link. Use the account invitation link instead.');
  if(!tokenHash&&!code&&!hasHashTokens)throw new Error('Open the password recovery link from your email, or request a new one.');
  if(tokenHash){
    if(type!=='recovery')throw new Error('Invalid password recovery link type.');
    const {error}=await db.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});
    if(error)throw error;
  }else if(code){
    const {error}=await db.auth.exchangeCodeForSession(code);
    if(error)throw error;
  }else if(hasHashTokens){
    const {error}=await db.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
    if(error)throw error;
  }
  const {data,error}=await db.auth.getUser();
  if(error||!data?.user)throw new Error('This recovery link is invalid or expired. Request a new link.');
  const {data:profile,error:profileError}=await db.from('client_profiles').select('id').eq('id',data.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)throw new Error('This link does not belong to a filings4u client account.');
  history.replaceState({},'',url.pathname);
  return data.user;
}
async function boot(){
  try{
    const user=await verifyRecoveryLink();
    ready=true;$('resetForm').hidden=false;
    $('pageText').textContent='Choose a new password for '+(user.email||'your account')+'.';
    message('Recovery link verified. Choose a new password.','ok');
    window.F4UTurnstile?.render?.();
    $('password')?.focus();
  }catch(e){
    console.warn('[filings4u recovery]',e.message);
    $('resetForm').hidden=true;
    message(e.message||'Unable to verify your recovery link.');
  }
}
$('resetForm')?.addEventListener('submit',async event=>{
  event.preventDefault();if(!ready||saving)return;
  const password=$('password').value,confirm=$('confirmPassword').value;
  if(password.length<8)return message('Your password must be at least 8 characters.');
  if(password!==confirm)return message('The passwords do not match.');
  saving=true;$('submit').disabled=true;$('submit').textContent='Saving…';
  try{
    if(!window.F4UTurnstile?.verify)throw new Error('Security verification is unavailable. Refresh the page.');
    await window.F4UTurnstile.verify();
    const {error}=await db.auth.updateUser({password});if(error)throw error;
    ready=false;message('Password changed. Redirecting to client sign in…','ok');
    await db.auth.signOut({scope:'local'});
    setTimeout(()=>location.replace('customer-login.html'),700);
  }catch(e){message(e.message||'Unable to update your password.');}
  finally{saving=false;$('submit').disabled=false;$('submit').textContent='Save password';}
});
document.querySelectorAll('[data-toggle]').forEach(button=>button.addEventListener('click',()=>{
  const input=$(button.dataset.toggle);if(!input)return;
  input.type=input.type==='password'?'text':'password';
  button.textContent=input.type==='password'?'Show':'Hide';
}));
boot();
})();
