// package: auth_service_proto
// file: auth_service.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from 'google-protobuf';

export class PingReq extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PingReq.AsObject;
  static toObject(includeInstance: boolean, msg: PingReq): PingReq.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: PingReq,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): PingReq;
  static deserializeBinaryFromReader(
    message: PingReq,
    reader: jspb.BinaryReader,
  ): PingReq;
}

export namespace PingReq {
  export type AsObject = {};
}

export class PongResp extends jspb.Message {
  getPong(): string;
  setPong(value: string): PongResp;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PongResp.AsObject;
  static toObject(includeInstance: boolean, msg: PongResp): PongResp.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: PongResp,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): PongResp;
  static deserializeBinaryFromReader(
    message: PongResp,
    reader: jspb.BinaryReader,
  ): PongResp;
}

export namespace PongResp {
  export type AsObject = {
    pong: string;
  };
}

export class UserAuthReq extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UserAuthReq.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: UserAuthReq,
  ): UserAuthReq.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: UserAuthReq,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): UserAuthReq;
  static deserializeBinaryFromReader(
    message: UserAuthReq,
    reader: jspb.BinaryReader,
  ): UserAuthReq;
}

export namespace UserAuthReq {
  export type AsObject = {};
}

export class Time extends jspb.Message {
  getMicroseconds(): number;
  setMicroseconds(value: number): Time;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Time.AsObject;
  static toObject(includeInstance: boolean, msg: Time): Time.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: Time,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): Time;
  static deserializeBinaryFromReader(
    message: Time,
    reader: jspb.BinaryReader,
  ): Time;
}

export namespace Time {
  export type AsObject = {
    microseconds: number;
  };
}

export class OverlayTemplates extends jspb.Message {
  getTransparentUrl(): string;
  setTransparentUrl(value: string): OverlayTemplates;
  getOverlayTemplateName(): string;
  setOverlayTemplateName(value: string): OverlayTemplates;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OverlayTemplates.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: OverlayTemplates,
  ): OverlayTemplates.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: OverlayTemplates,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): OverlayTemplates;
  static deserializeBinaryFromReader(
    message: OverlayTemplates,
    reader: jspb.BinaryReader,
  ): OverlayTemplates;
}

export namespace OverlayTemplates {
  export type AsObject = {
    transparentUrl: string;
    overlayTemplateName: string;
  };
}

export class UserAuthResp extends jspb.Message {
  getAddress1(): string;
  setAddress1(value: string): UserAuthResp;
  getAddress2(): string;
  setAddress2(value: string): UserAuthResp;
  getAddress(): string;
  setAddress(value: string): UserAuthResp;
  getAdvertisingCampaign(): string;
  setAdvertisingCampaign(value: string): UserAuthResp;
  getAdvertisingCampaignId(): string;
  setAdvertisingCampaignId(value: string): UserAuthResp;
  getAdvertisingId(): string;
  setAdvertisingId(value: string): UserAuthResp;
  getAdvertisingObjectiveName(): string;
  setAdvertisingObjectiveName(value: string): UserAuthResp;
  getAdvertisingPartner(): string;
  setAdvertisingPartner(value: string): UserAuthResp;
  getAdvertisingSetId(): string;
  setAdvertisingSetId(value: string): UserAuthResp;
  getAdvertisingSetName(): string;
  setAdvertisingSetName(value: string): UserAuthResp;
  getBannedIdfa(): string;
  setBannedIdfa(value: string): UserAuthResp;
  getCatalogueName(): string;
  setCatalogueName(value: string): UserAuthResp;
  getCity(): string;
  setCity(value: string): UserAuthResp;
  getCodepushVersion(): string;
  setCodepushVersion(value: string): UserAuthResp;
  getCreatedAt(): string;
  setCreatedAt(value: string): UserAuthResp;
  getCxAddress1(): string;
  setCxAddress1(value: string): UserAuthResp;
  getCxAddress2(): string;
  setCxAddress2(value: string): UserAuthResp;
  getCxCity(): string;
  setCxCity(value: string): UserAuthResp;
  getCxLandmark(): string;
  setCxLandmark(value: string): UserAuthResp;
  getCxPincode(): string;
  setCxPincode(value: string): UserAuthResp;
  getCxState(): string;
  setCxState(value: string): UserAuthResp;
  getDob(): string;
  setDob(value: string): UserAuthResp;
  getExpiresAt(): string;
  setExpiresAt(value: string): UserAuthResp;
  getFirstOrderCreatedAt(): string;
  setFirstOrderCreatedAt(value: string): UserAuthResp;
  getFirstOrderId(): string;
  setFirstOrderId(value: string): UserAuthResp;
  getFirstVersionCode(): string;
  setFirstVersionCode(value: string): UserAuthResp;
  getFirstVersionName(): string;
  setFirstVersionName(value: string): UserAuthResp;
  getFromUserApp(): boolean;
  setFromUserApp(value: boolean): UserAuthResp;
  getGroupinvitelink(): string;
  setGroupinvitelink(value: string): UserAuthResp;
  getId(): string;
  setId(value: string): UserAuthResp;
  getIdfa(): string;
  setIdfa(value: string): UserAuthResp;
  getImage(): string;
  setImage(value: string): UserAuthResp;
  getInstallGoogleAdCampaign(): string;
  setInstallGoogleAdCampaign(value: string): UserAuthResp;
  getIsCmo(): boolean;
  setIsCmo(value: boolean): UserAuthResp;
  getIsFirstLogin(): boolean;
  setIsFirstLogin(value: boolean): UserAuthResp;
  getIsSuspended(): boolean;
  setIsSuspended(value: boolean): UserAuthResp;
  getLandmark(): string;
  setLandmark(value: string): UserAuthResp;
  getLanguage(): string;
  setLanguage(value: string): UserAuthResp;
  getLastLogin(): string;
  setLastLogin(value: string): UserAuthResp;
  getLeaderid(): string;
  setLeaderid(value: string): UserAuthResp;
  getLeaderimage(): string;
  setLeaderimage(value: string): UserAuthResp;
  getLeaderlat(): string;
  setLeaderlat(value: string): UserAuthResp;
  getLeaderlng(): string;
  setLeaderlng(value: string): UserAuthResp;
  getLeadername(): string;
  setLeadername(value: string): UserAuthResp;
  getLeaderphonenumber(): string;
  setLeaderphonenumber(value: string): UserAuthResp;
  getLeaderurl(): string;
  setLeaderurl(value: string): UserAuthResp;
  getLeaderuserid(): string;
  setLeaderuserid(value: string): UserAuthResp;
  getLeaderPosition(): string;
  setLeaderPosition(value: string): UserAuthResp;
  getLeaderSubPosition(): string;
  setLeaderSubPosition(value: string): UserAuthResp;
  getLocality(): string;
  setLocality(value: string): UserAuthResp;
  getLocationSanityConfirmedByUser(): boolean;
  setLocationSanityConfirmedByUser(value: boolean): UserAuthResp;
  clearLocationSanityIssuesList(): void;
  getLocationSanityIssuesList(): Array<string>;
  setLocationSanityIssuesList(value: Array<string>): UserAuthResp;
  addLocationSanityIssues(value: string, index?: number): string;
  getLoggedOutAt(): string;
  setLoggedOutAt(value: string): UserAuthResp;
  getMmServiceable(): boolean;
  setMmServiceable(value: boolean): UserAuthResp;
  getOneSignalUserId(): string;
  setOneSignalUserId(value: string): UserAuthResp;
  clearOverlaytemplatesList(): void;
  getOverlaytemplatesList(): Array<OverlayTemplates>;
  setOverlaytemplatesList(value: Array<OverlayTemplates>): UserAuthResp;
  addOverlaytemplates(
    value?: OverlayTemplates,
    index?: number,
  ): OverlayTemplates;
  getPhoneNumber(): string;
  setPhoneNumber(value: string): UserAuthResp;
  getPincode(): string;
  setPincode(value: string): UserAuthResp;
  getPromoOptedIn(): boolean;
  setPromoOptedIn(value: boolean): UserAuthResp;
  getRatingDone(): boolean;
  setRatingDone(value: boolean): UserAuthResp;
  getReferlink(): string;
  setReferlink(value: string): UserAuthResp;
  getReferralCode(): string;
  setReferralCode(value: string): UserAuthResp;
  getRzpayContactId(): string;
  setRzpayContactId(value: string): UserAuthResp;
  getSignupCode(): string;
  setSignupCode(value: string): UserAuthResp;
  getSpokeName(): string;
  setSpokeName(value: string): UserAuthResp;
  getState(): string;
  setState(value: string): UserAuthResp;
  getSyncedCt(): boolean;
  setSyncedCt(value: boolean): UserAuthResp;
  clearTagsList(): void;
  getTagsList(): Array<string>;
  setTagsList(value: Array<string>): UserAuthResp;
  addTags(value: string, index?: number): string;
  getTlpersonalwalink(): string;
  setTlpersonalwalink(value: string): UserAuthResp;
  getTrackingInfoJson(): string;
  setTrackingInfoJson(value: string): UserAuthResp;
  getUserCreated(): string;
  setUserCreated(value: string): UserAuthResp;
  getUserId(): string;
  setUserId(value: string): UserAuthResp;
  getUserImage(): string;
  setUserImage(value: string): UserAuthResp;
  getUserName(): string;
  setUserName(value: string): UserAuthResp;
  getUserPhone(): string;
  setUserPhone(value: string): UserAuthResp;
  getUserType(): string;
  setUserType(value: string): UserAuthResp;
  getUserUpdated(): string;
  setUserUpdated(value: string): UserAuthResp;
  getUsersUserId(): string;
  setUsersUserId(value: string): UserAuthResp;
  getVersionCode(): string;
  setVersionCode(value: string): UserAuthResp;
  getVersionName(): string;
  setVersionName(value: string): UserAuthResp;
  getWhatsappOptedIn(): boolean;
  setWhatsappOptedIn(value: boolean): UserAuthResp;
  getWithdrawalsDisabled(): boolean;
  setWithdrawalsDisabled(value: boolean): UserAuthResp;
  getReferapplink(): string;
  setReferapplink(value: string): UserAuthResp;
  getIsConnectedByCm(): boolean;
  setIsConnectedByCm(value: boolean): UserAuthResp;
  getIsCxSuspended(): boolean;
  setIsCxSuspended(value: boolean): UserAuthResp;
  getLeaderstate(): string;
  setLeaderstate(value: string): UserAuthResp;
  getCxLat(): string;
  setCxLat(value: string): UserAuthResp;
  getCxLng(): string;
  setCxLng(value: string): UserAuthResp;
  getUniqueDeviceId(): string;
  setUniqueDeviceId(value: string): UserAuthResp;
  getIsPcEnabled(): boolean;
  setIsPcEnabled(value: boolean): UserAuthResp;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UserAuthResp.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: UserAuthResp,
  ): UserAuthResp.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: UserAuthResp,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): UserAuthResp;
  static deserializeBinaryFromReader(
    message: UserAuthResp,
    reader: jspb.BinaryReader,
  ): UserAuthResp;
}

export namespace UserAuthResp {
  export type AsObject = {
    address1: string;
    address2: string;
    address: string;
    advertisingCampaign: string;
    advertisingCampaignId: string;
    advertisingId: string;
    advertisingObjectiveName: string;
    advertisingPartner: string;
    advertisingSetId: string;
    advertisingSetName: string;
    bannedIdfa: string;
    catalogueName: string;
    city: string;
    codepushVersion: string;
    createdAt: string;
    cxAddress1: string;
    cxAddress2: string;
    cxCity: string;
    cxLandmark: string;
    cxPincode: string;
    cxState: string;
    dob: string;
    expiresAt: string;
    firstOrderCreatedAt: string;
    firstOrderId: string;
    firstVersionCode: string;
    firstVersionName: string;
    fromUserApp: boolean;
    groupinvitelink: string;
    id: string;
    idfa: string;
    image: string;
    installGoogleAdCampaign: string;
    isCmo: boolean;
    isFirstLogin: boolean;
    isSuspended: boolean;
    landmark: string;
    language: string;
    lastLogin: string;
    leaderid: string;
    leaderimage: string;
    leaderlat: string;
    leaderlng: string;
    leadername: string;
    leaderphonenumber: string;
    leaderurl: string;
    leaderuserid: string;
    leaderPosition: string;
    leaderSubPosition: string;
    locality: string;
    locationSanityConfirmedByUser: boolean;
    locationSanityIssuesList: Array<string>;
    loggedOutAt: string;
    mmServiceable: boolean;
    oneSignalUserId: string;
    overlaytemplatesList: Array<OverlayTemplates.AsObject>;
    phoneNumber: string;
    pincode: string;
    promoOptedIn: boolean;
    ratingDone: boolean;
    referlink: string;
    referralCode: string;
    rzpayContactId: string;
    signupCode: string;
    spokeName: string;
    state: string;
    syncedCt: boolean;
    tagsList: Array<string>;
    tlpersonalwalink: string;
    trackingInfoJson: string;
    userCreated: string;
    userId: string;
    userImage: string;
    userName: string;
    userPhone: string;
    userType: string;
    userUpdated: string;
    usersUserId: string;
    versionCode: string;
    versionName: string;
    whatsappOptedIn: boolean;
    withdrawalsDisabled: boolean;
    referapplink: string;
    isConnectedByCm: boolean;
    isCxSuspended: boolean;
    leaderstate: string;
    cxLat: string;
    cxLng: string;
    uniqueDeviceId: string;
    isPcEnabled: boolean;
  };
}

export class LeaderAuthReq extends jspb.Message {
  getShouldforceresetsession(): boolean;
  setShouldforceresetsession(value: boolean): LeaderAuthReq;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LeaderAuthReq.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: LeaderAuthReq,
  ): LeaderAuthReq.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: LeaderAuthReq,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): LeaderAuthReq;
  static deserializeBinaryFromReader(
    message: LeaderAuthReq,
    reader: jspb.BinaryReader,
  ): LeaderAuthReq;
}

export namespace LeaderAuthReq {
  export type AsObject = {
    shouldforceresetsession: boolean;
  };
}

export class LeaderAuthResp extends jspb.Message {
  getAcquiredAt(): string;
  setAcquiredAt(value: string): LeaderAuthResp;
  getAddress(): string;
  setAddress(value: string): LeaderAuthResp;
  getAddress1(): string;
  setAddress1(value: string): LeaderAuthResp;
  getAddress2(): string;
  setAddress2(value: string): LeaderAuthResp;
  getAddressName(): string;
  setAddressName(value: string): LeaderAuthResp;
  getAddressPhone(): string;
  setAddressPhone(value: string): LeaderAuthResp;
  getAddressUserId(): string;
  setAddressUserId(value: string): LeaderAuthResp;
  getAge(): string;
  setAge(value: string): LeaderAuthResp;
  getAlreadyACx(): boolean;
  setAlreadyACx(value: boolean): LeaderAuthResp;
  getAlreadyACxWoOrder(): boolean;
  setAlreadyACxWoOrder(value: boolean): LeaderAuthResp;
  getAlternatePhone(): string;
  setAlternatePhone(value: string): LeaderAuthResp;
  getAppShareLink(): string;
  setAppShareLink(value: string): LeaderAuthResp;
  getApprovedBy(): string;
  setApprovedBy(value: string): LeaderAuthResp;
  getAtlId(): string;
  setAtlId(value: string): LeaderAuthResp;
  getAvailabilityHours(): string;
  setAvailabilityHours(value: string): LeaderAuthResp;

  hasBankDetails(): boolean;
  clearBankDetails(): void;
  getBankDetails(): LeaderAuthResp.BankDetails | undefined;
  setBankDetails(value?: LeaderAuthResp.BankDetails): LeaderAuthResp;
  getCatalogueName(): string;
  setCatalogueName(value: string): LeaderAuthResp;
  getCity(): string;
  setCity(value: string): LeaderAuthResp;
  getCreatedAt(): string;
  setCreatedAt(value: string): LeaderAuthResp;
  getDeviceLocationGeog(): string;
  setDeviceLocationGeog(value: string): LeaderAuthResp;
  getDirectorAt(): string;
  setDirectorAt(value: string): LeaderAuthResp;
  getDiscardedAt(): string;
  setDiscardedAt(value: string): LeaderAuthResp;
  getDob(): string;
  setDob(value: string): LeaderAuthResp;
  getExpiresAt(): string;
  setExpiresAt(value: string): LeaderAuthResp;
  getFirstVersionCode(): string;
  setFirstVersionCode(value: string): LeaderAuthResp;
  getFirstVersionName(): string;
  setFirstVersionName(value: string): LeaderAuthResp;
  getGender(): string;
  setGender(value: string): LeaderAuthResp;
  getGeogReverseGeocodePincode(): string;
  setGeogReverseGeocodePincode(value: string): LeaderAuthResp;
  getGrocerySpending(): string;
  setGrocerySpending(value: string): LeaderAuthResp;
  getHasRaisedTicket(): boolean;
  setHasRaisedTicket(value: boolean): LeaderAuthResp;
  getId(): string;
  setId(value: string): LeaderAuthResp;
  getIdfa(): string;
  setIdfa(value: string): LeaderAuthResp;
  getIncome(): string;
  setIncome(value: string): LeaderAuthResp;
  getIsApproved(): boolean;
  setIsApproved(value: boolean): LeaderAuthResp;
  getIsServiceable(): boolean;
  setIsServiceable(value: boolean): LeaderAuthResp;
  getIsSuspended(): boolean;
  setIsSuspended(value: boolean): LeaderAuthResp;
  getLandmark(): string;
  setLandmark(value: string): LeaderAuthResp;
  getLanguage(): string;
  setLanguage(value: string): LeaderAuthResp;
  getLastPhoneNumberChangedAt(): string;
  setLastPhoneNumberChangedAt(value: string): LeaderAuthResp;
  getLat(): string;
  setLat(value: string): LeaderAuthResp;
  getLng(): string;
  setLng(value: string): LeaderAuthResp;
  getLeaderId(): string;
  setLeaderId(value: string): LeaderAuthResp;
  getLeaderRating(): string;
  setLeaderRating(value: string): LeaderAuthResp;
  getLocality(): string;
  setLocality(value: string): LeaderAuthResp;
  getLoggedOutAt(): string;
  setLoggedOutAt(value: string): LeaderAuthResp;
  getMarketingLink(): string;
  setMarketingLink(value: string): LeaderAuthResp;
  getMmServiceable(): boolean;
  setMmServiceable(value: boolean): LeaderAuthResp;
  getName(): string;
  setName(value: string): LeaderAuthResp;
  getNoOfFamilyMembers(): string;
  setNoOfFamilyMembers(value: string): LeaderAuthResp;
  getOccupation(): string;
  setOccupation(value: string): LeaderAuthResp;
  getOnboardingStatus(): number;
  setOnboardingStatus(value: number): LeaderAuthResp;
  clearOverlaytemplatesList(): void;
  getOverlaytemplatesList(): Array<OverlayTemplates>;
  setOverlaytemplatesList(value: Array<OverlayTemplates>): LeaderAuthResp;
  addOverlaytemplates(
    value?: OverlayTemplates,
    index?: number,
  ): OverlayTemplates;
  getPancardNumber(): string;
  setPancardNumber(value: string): LeaderAuthResp;
  getPhoneNumber(): string;
  setPhoneNumber(value: string): LeaderAuthResp;
  getPincode(): string;
  setPincode(value: string): LeaderAuthResp;
  getPosition(): string;
  setPosition(value: string): LeaderAuthResp;
  getReferlink(): string;
  setReferlink(value: string): LeaderAuthResp;
  getReferClLink(): string;
  setReferClLink(value: string): LeaderAuthResp;
  getRejectedAt(): string;
  setRejectedAt(value: string): LeaderAuthResp;
  getRzpayContactId(): string;
  setRzpayContactId(value: string): LeaderAuthResp;
  getServiceabilityRadius(): number;
  setServiceabilityRadius(value: number): LeaderAuthResp;
  getSource(): string;
  setSource(value: string): LeaderAuthResp;
  getSpokeName(): string;
  setSpokeName(value: string): LeaderAuthResp;
  getState(): string;
  setState(value: string): LeaderAuthResp;
  clearTagsList(): void;
  getTagsList(): Array<string>;
  setTagsList(value: Array<string>): LeaderAuthResp;
  addTags(value: string, index?: number): string;
  getTlAppRatingDone(): boolean;
  setTlAppRatingDone(value: boolean): LeaderAuthResp;
  getTlId(): string;
  setTlId(value: string): LeaderAuthResp;
  getUrl(): string;
  setUrl(value: string): LeaderAuthResp;
  getUserId(): string;
  setUserId(value: string): LeaderAuthResp;
  getUserImage(): string;
  setUserImage(value: string): LeaderAuthResp;
  getVehicle(): string;
  setVehicle(value: string): LeaderAuthResp;
  getVersionCode(): string;
  setVersionCode(value: string): LeaderAuthResp;
  getVersionName(): string;
  setVersionName(value: string): LeaderAuthResp;
  getWhatsappOptedIn(): boolean;
  setWhatsappOptedIn(value: boolean): LeaderAuthResp;
  getWithdrawalsDisabled(): boolean;
  setWithdrawalsDisabled(value: boolean): LeaderAuthResp;
  getReferClAppLink(): string;
  setReferClAppLink(value: string): LeaderAuthResp;
  getAppShareAppLink(): string;
  setAppShareAppLink(value: string): LeaderAuthResp;
  getCanCreateNeighbourhoodCx(): string;
  setCanCreateNeighbourhoodCx(value: string): LeaderAuthResp;
  getCanMeetNeighbourhoodCx(): string;
  setCanMeetNeighbourhoodCx(value: string): LeaderAuthResp;
  getJoiningReason(): string;
  setJoiningReason(value: string): LeaderAuthResp;
  getLeaderShop(): string;
  setLeaderShop(value: string): LeaderAuthResp;
  getLeaderState(): string;
  setLeaderState(value: string): LeaderAuthResp;
  getMartialStatus(): string;
  setMartialStatus(value: string): LeaderAuthResp;
  getNetworkCompany(): string;
  setNetworkCompany(value: string): LeaderAuthResp;
  getReadyToDeliver(): string;
  setReadyToDeliver(value: string): LeaderAuthResp;
  getShopName(): string;
  setShopName(value: string): LeaderAuthResp;
  getIsVerifiedPartner(): boolean;
  setIsVerifiedPartner(value: boolean): LeaderAuthResp;
  getUniqueDeviceId(): string;
  setUniqueDeviceId(value: string): LeaderAuthResp;
  getAutoReadOtp(): boolean;
  setAutoReadOtp(value: boolean): LeaderAuthResp;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LeaderAuthResp.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: LeaderAuthResp,
  ): LeaderAuthResp.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: LeaderAuthResp,
    writer: jspb.BinaryWriter,
  ): void;
  static deserializeBinary(bytes: Uint8Array): LeaderAuthResp;
  static deserializeBinaryFromReader(
    message: LeaderAuthResp,
    reader: jspb.BinaryReader,
  ): LeaderAuthResp;
}

export namespace LeaderAuthResp {
  export type AsObject = {
    acquiredAt: string;
    address: string;
    address1: string;
    address2: string;
    addressName: string;
    addressPhone: string;
    addressUserId: string;
    age: string;
    alreadyACx: boolean;
    alreadyACxWoOrder: boolean;
    alternatePhone: string;
    appShareLink: string;
    approvedBy: string;
    atlId: string;
    availabilityHours: string;
    bankDetails?: LeaderAuthResp.BankDetails.AsObject;
    catalogueName: string;
    city: string;
    createdAt: string;
    deviceLocationGeog: string;
    directorAt: string;
    discardedAt: string;
    dob: string;
    expiresAt: string;
    firstVersionCode: string;
    firstVersionName: string;
    gender: string;
    geogReverseGeocodePincode: string;
    grocerySpending: string;
    hasRaisedTicket: boolean;
    id: string;
    idfa: string;
    income: string;
    isApproved: boolean;
    isServiceable: boolean;
    isSuspended: boolean;
    landmark: string;
    language: string;
    lastPhoneNumberChangedAt: string;
    lat: string;
    lng: string;
    leaderId: string;
    leaderRating: string;
    locality: string;
    loggedOutAt: string;
    marketingLink: string;
    mmServiceable: boolean;
    name: string;
    noOfFamilyMembers: string;
    occupation: string;
    onboardingStatus: number;
    overlaytemplatesList: Array<OverlayTemplates.AsObject>;
    pancardNumber: string;
    phoneNumber: string;
    pincode: string;
    position: string;
    referlink: string;
    referClLink: string;
    rejectedAt: string;
    rzpayContactId: string;
    serviceabilityRadius: number;
    source: string;
    spokeName: string;
    state: string;
    tagsList: Array<string>;
    tlAppRatingDone: boolean;
    tlId: string;
    url: string;
    userId: string;
    userImage: string;
    vehicle: string;
    versionCode: string;
    versionName: string;
    whatsappOptedIn: boolean;
    withdrawalsDisabled: boolean;
    referClAppLink: string;
    appShareAppLink: string;
    canCreateNeighbourhoodCx: string;
    canMeetNeighbourhoodCx: string;
    joiningReason: string;
    leaderShop: string;
    leaderState: string;
    martialStatus: string;
    networkCompany: string;
    readyToDeliver: string;
    shopName: string;
    isVerifiedPartner: boolean;
    uniqueDeviceId: string;
    autoReadOtp: boolean;
  };

  export class BankDetails extends jspb.Message {
    getAccountHolderName(): string;
    setAccountHolderName(value: string): BankDetails;
    getAccountNumber(): string;
    setAccountNumber(value: string): BankDetails;
    getBankName(): string;
    setBankName(value: string): BankDetails;
    getIfscCode(): string;
    setIfscCode(value: string): BankDetails;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BankDetails.AsObject;
    static toObject(
      includeInstance: boolean,
      msg: BankDetails,
    ): BankDetails.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: {
      [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
    };
    static serializeBinaryToWriter(
      message: BankDetails,
      writer: jspb.BinaryWriter,
    ): void;
    static deserializeBinary(bytes: Uint8Array): BankDetails;
    static deserializeBinaryFromReader(
      message: BankDetails,
      reader: jspb.BinaryReader,
    ): BankDetails;
  }

  export namespace BankDetails {
    export type AsObject = {
      accountHolderName: string;
      accountNumber: string;
      bankName: string;
      ifscCode: string;
    };
  }
}
