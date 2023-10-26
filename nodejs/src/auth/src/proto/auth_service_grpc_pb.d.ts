// package: auth_service_proto
// file: auth_service.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from '@grpc/grpc-js';
import * as auth_service_pb from './auth_service_pb';

interface IAuthServiceService
  extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  heartBeat: IAuthServiceService_IHeartBeat;
  userAuth: IAuthServiceService_IUserAuth;
  leaderAuth: IAuthServiceService_ILeaderAuth;
}

interface IAuthServiceService_IHeartBeat
  extends grpc.MethodDefinition<
    auth_service_pb.PingReq,
    auth_service_pb.PongResp
  > {
  path: '/auth_service_proto.AuthService/HeartBeat';
  requestStream: false;
  responseStream: false;
  requestSerialize: grpc.serialize<auth_service_pb.PingReq>;
  requestDeserialize: grpc.deserialize<auth_service_pb.PingReq>;
  responseSerialize: grpc.serialize<auth_service_pb.PongResp>;
  responseDeserialize: grpc.deserialize<auth_service_pb.PongResp>;
}
interface IAuthServiceService_IUserAuth
  extends grpc.MethodDefinition<
    auth_service_pb.UserAuthReq,
    auth_service_pb.UserAuthResp
  > {
  path: '/auth_service_proto.AuthService/UserAuth';
  requestStream: false;
  responseStream: false;
  requestSerialize: grpc.serialize<auth_service_pb.UserAuthReq>;
  requestDeserialize: grpc.deserialize<auth_service_pb.UserAuthReq>;
  responseSerialize: grpc.serialize<auth_service_pb.UserAuthResp>;
  responseDeserialize: grpc.deserialize<auth_service_pb.UserAuthResp>;
}
interface IAuthServiceService_ILeaderAuth
  extends grpc.MethodDefinition<
    auth_service_pb.LeaderAuthReq,
    auth_service_pb.LeaderAuthResp
  > {
  path: '/auth_service_proto.AuthService/LeaderAuth';
  requestStream: false;
  responseStream: false;
  requestSerialize: grpc.serialize<auth_service_pb.LeaderAuthReq>;
  requestDeserialize: grpc.deserialize<auth_service_pb.LeaderAuthReq>;
  responseSerialize: grpc.serialize<auth_service_pb.LeaderAuthResp>;
  responseDeserialize: grpc.deserialize<auth_service_pb.LeaderAuthResp>;
}

export const AuthServiceService: IAuthServiceService;

export interface IAuthServiceServer extends grpc.UntypedServiceImplementation {
  heartBeat: grpc.handleUnaryCall<
    auth_service_pb.PingReq,
    auth_service_pb.PongResp
  >;
  userAuth: grpc.handleUnaryCall<
    auth_service_pb.UserAuthReq,
    auth_service_pb.UserAuthResp
  >;
  leaderAuth: grpc.handleUnaryCall<
    auth_service_pb.LeaderAuthReq,
    auth_service_pb.LeaderAuthResp
  >;
}

export interface IAuthServiceClient {
  heartBeat(
    request: auth_service_pb.PingReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  heartBeat(
    request: auth_service_pb.PingReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  heartBeat(
    request: auth_service_pb.PingReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  userAuth(
    request: auth_service_pb.UserAuthReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  userAuth(
    request: auth_service_pb.UserAuthReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  userAuth(
    request: auth_service_pb.UserAuthReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
}

export class AuthServiceClient
  extends grpc.Client
  implements IAuthServiceClient
{
  constructor(
    address: string,
    credentials: grpc.ChannelCredentials,
    options?: Partial<grpc.ClientOptions>,
  );
  public heartBeat(
    request: auth_service_pb.PingReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public heartBeat(
    request: auth_service_pb.PingReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public heartBeat(
    request: auth_service_pb.PingReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.PongResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public userAuth(
    request: auth_service_pb.UserAuthReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public userAuth(
    request: auth_service_pb.UserAuthReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public userAuth(
    request: auth_service_pb.UserAuthReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.UserAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
  public leaderAuth(
    request: auth_service_pb.LeaderAuthReq,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: auth_service_pb.LeaderAuthResp,
    ) => void,
  ): grpc.ClientUnaryCall;
}
