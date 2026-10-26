import {randomBytes,pbkdf2Sync} from 'node:crypto';
const [email]=process.argv.slice(2);const password=process.env.ADMIN_PASSWORD;
if(!email||!password||password.length<14)throw Error('Provide email argument and ADMIN_PASSWORD environment variable (14+ characters).');
const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
console.log(`INSERT INTO admin_users(id,email,password_hash,salt) VALUES (${[randomBytes(16).toString('hex'),email.toLowerCase(),hash,salt].map(quote).join(',')});`);
