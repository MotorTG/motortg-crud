import * as jose from 'jose'

const main = async () => {
const { publicKey, privateKey } = await jose.generateKeyPair('ES256', {extractable: true})
console.log("public: "+jose.base64url.encode(await jose.exportSPKI(publicKey)))
console.log("private: "+jose.base64url.encode(await jose.exportPKCS8(privateKey)))
}

main()
