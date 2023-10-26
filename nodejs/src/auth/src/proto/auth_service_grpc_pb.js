// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var auth_service_pb = require('./auth_service_pb.js');

function serialize_auth_service_proto_LeaderAuthReq(arg) {
  if (!(arg instanceof auth_service_pb.LeaderAuthReq)) {
    throw new Error(
      'Expected argument of type auth_service_proto.LeaderAuthReq',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_LeaderAuthReq(buffer_arg) {
  return auth_service_pb.LeaderAuthReq.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_auth_service_proto_LeaderAuthResp(arg) {
  if (!(arg instanceof auth_service_pb.LeaderAuthResp)) {
    throw new Error(
      'Expected argument of type auth_service_proto.LeaderAuthResp',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_LeaderAuthResp(buffer_arg) {
  return auth_service_pb.LeaderAuthResp.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_auth_service_proto_PingReq(arg) {
  if (!(arg instanceof auth_service_pb.PingReq)) {
    throw new Error('Expected argument of type auth_service_proto.PingReq');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_PingReq(buffer_arg) {
  return auth_service_pb.PingReq.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_service_proto_PongResp(arg) {
  if (!(arg instanceof auth_service_pb.PongResp)) {
    throw new Error('Expected argument of type auth_service_proto.PongResp');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_PongResp(buffer_arg) {
  return auth_service_pb.PongResp.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_service_proto_UserAuthReq(arg) {
  if (!(arg instanceof auth_service_pb.UserAuthReq)) {
    throw new Error('Expected argument of type auth_service_proto.UserAuthReq');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_UserAuthReq(buffer_arg) {
  return auth_service_pb.UserAuthReq.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_auth_service_proto_UserAuthResp(arg) {
  if (!(arg instanceof auth_service_pb.UserAuthResp)) {
    throw new Error(
      'Expected argument of type auth_service_proto.UserAuthResp',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_service_proto_UserAuthResp(buffer_arg) {
  return auth_service_pb.UserAuthResp.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

var AuthServiceService = (exports.AuthServiceService = {
  heartBeat: {
    path: '/auth_service_proto.AuthService/HeartBeat',
    requestStream: false,
    responseStream: false,
    requestType: auth_service_pb.PingReq,
    responseType: auth_service_pb.PongResp,
    requestSerialize: serialize_auth_service_proto_PingReq,
    requestDeserialize: deserialize_auth_service_proto_PingReq,
    responseSerialize: serialize_auth_service_proto_PongResp,
    responseDeserialize: deserialize_auth_service_proto_PongResp,
  },
  userAuth: {
    path: '/auth_service_proto.AuthService/UserAuth',
    requestStream: false,
    responseStream: false,
    requestType: auth_service_pb.UserAuthReq,
    responseType: auth_service_pb.UserAuthResp,
    requestSerialize: serialize_auth_service_proto_UserAuthReq,
    requestDeserialize: deserialize_auth_service_proto_UserAuthReq,
    responseSerialize: serialize_auth_service_proto_UserAuthResp,
    responseDeserialize: deserialize_auth_service_proto_UserAuthResp,
  },
  leaderAuth: {
    path: '/auth_service_proto.AuthService/LeaderAuth',
    requestStream: false,
    responseStream: false,
    requestType: auth_service_pb.LeaderAuthReq,
    responseType: auth_service_pb.LeaderAuthResp,
    requestSerialize: serialize_auth_service_proto_LeaderAuthReq,
    requestDeserialize: deserialize_auth_service_proto_LeaderAuthReq,
    responseSerialize: serialize_auth_service_proto_LeaderAuthResp,
    responseDeserialize: deserialize_auth_service_proto_LeaderAuthResp,
  },
});

exports.AuthServiceClient =
  grpc.makeGenericClientConstructor(AuthServiceService);
