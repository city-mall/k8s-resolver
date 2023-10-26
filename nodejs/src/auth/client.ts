import { AuthServiceClient } from "./src/proto/auth_service_grpc_pb";
import {
  PingReq,
  PongResp,
  UserAuthReq,
  UserAuthResp,
  LeaderAuthReq,
  LeaderAuthResp,
} from "./src/proto/auth_service_pb";
import * as grpc from "@grpc/grpc-js";

const UNAUTHORISED = "UNAUTHORISED";

export class AuthServiceGrpc {
  private readonly stub = new AuthServiceClient(
    this.authServiceGrpcHost,
    grpc.credentials.createInsecure()
  );

  constructor(
    private readonly authServiceGrpcHost: string,
    private readonly debugTime = true
  ) {
    console.log({ authServiceGrpcHost });
  }

  private getOptions() {
    return {
      deadline: new Date().setSeconds(new Date().getSeconds() + 30),
    };
  }

  async heartBeat() {
    const start = new Date().getTime();
    const req = new PingReq();

    const metadata = new grpc.Metadata();

    return new Promise<PongResp.AsObject>((resolve, reject) => {
      this.stub.heartBeat(
        req,
        metadata,
        this.getOptions(),
        (err: grpc.ServiceError | null, res: PongResp) => {
          if (err) return reject(err);

          if (this.debugTime) {
            console.log(
              "Time taken heartBeat:",
              new Date().getTime() - start,
              "ms"
            );
          }

          if (!res) return reject("No Response");
          resolve(res.toObject());
        }
      );
    });
  }

  async userAuth(token: string) {
    try {
      const start = new Date().getTime();
      const req = new UserAuthReq();

      const metadata = new grpc.Metadata();
      metadata.add("authorization", token);

      return new Promise((resolve, reject) => {
        this.stub.userAuth(
          req,
          metadata,
          this.getOptions(),
          (err: grpc.ServiceError | null, res: UserAuthResp) => {
            if (err) return reject(err);

            if (this.debugTime) {
              console.log(
                "Time taken userAuth:",
                new Date().getTime() - start,
                "ms"
              );
            }

            if (!res) return reject("No Response");
            resolve(res.toObject());
          }
        );
      });
    } catch (err: any) {
      if (
        err &&
        err.message &&
        (err.message.indexOf("16 UNAUTHENTICATED: Unauthorised") !== -1 ||
          err.message.indexOf("13 INTERNAL: Unauthorised") !== -1)
      ) {
        throw new Error(UNAUTHORISED);
      } else {
        throw err;
      }
    }
  }

  async leaderAuth(token: string, shouldForceResetSession: boolean) {
    try {
      const start = new Date().getTime();
      const req = new LeaderAuthReq();
      req.setShouldforceresetsession(shouldForceResetSession);

      const metadata = new grpc.Metadata();
      metadata.add("authorization", token);

      return new Promise((resolve, reject) => {
        this.stub.leaderAuth(
          req,
          metadata,
          this.getOptions(),
          (err: grpc.ServiceError | null, res: LeaderAuthResp) => {
            if (err) return reject(err);

            if (this.debugTime) {
              console.log(
                "Time taken leaderAuth:",
                new Date().getTime() - start,
                "ms"
              );
            }

            if (!res) return reject("No Response");
            resolve(res.toObject());
          }
        );
      });
    } catch (err: any) {
      if (
        err &&
        err.message &&
        (err.message.indexOf("16 UNAUTHENTICATED: Unauthorised") !== -1 ||
          err.message.indexOf("13 INTERNAL: Unauthorised") !== -1)
      ) {
        throw new Error(UNAUTHORISED);
      } else {
        throw err;
      }
    }
  }
}
