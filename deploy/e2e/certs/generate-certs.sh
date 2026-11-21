#!/bin/sh
# Eigene Test-CA und ein Serverzertifikat für vm.test und auth.vm.test (nur für den KI-Testlauf).
# Läuft als Init-Container; vorhandene Dateien bleiben, damit Browser und API derselben CA vertrauen.
set -eu
cd /certs
if [ -f ca.crt ] && [ -f server.crt ] && [ -f server.key ]; then
  echo "certs: vorhanden"
  exit 0
fi
apk add --no-cache openssl >/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=VM-Web E2E Test CA" \
  -keyout ca.key -out ca.crt \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -newkey rsa:2048 -nodes -subj "/CN=vm.test" -keyout server.key -out server.csr
cat > server.ext <<EXT
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:vm.test,DNS:auth.vm.test
EXT
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -extfile server.ext -out server.crt
rm -f server.csr server.ext ca.srl
chmod 644 ca.crt server.crt server.key
echo "certs: erzeugt"
