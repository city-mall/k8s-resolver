import { K8sScheme, setup } from ".";
import { AuthServiceGrpc } from "./auth/client";

setup();

async function main() {
  let address = "auth-service-grpc-cs-headless.prod-cs.svc.cluster.local:8088";
  if (address.indexOf("svc.cluster.local") !== -1) {
    const [host, servicePort] = address.split(":");
    const [serviceName, serviceNs] = host.split(".");
    address = `${K8sScheme}://${serviceNs}/${serviceName}:${servicePort}`;
  }
  const auth = new AuthServiceGrpc(address);
  const resp = await auth.userAuth("abcd1234");
  console.log(resp);
}

main().catch(console.error);
