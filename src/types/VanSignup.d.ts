declare interface VanSignup {
  /////////////////////// TODO: extract --v
  actionKitId: number,
  vanId?: number,
  id?: number,
  ////////////////////
  eventSignupId?: number,
  status: VanSignupStatus,
  startTimeOverride?: Date | string,
  endTimeOverride?: Date | string,
  printedLists?: object[],
  minivanExports?: object[],
  person: VanPerson,
  event?: VanEvent,
  shift?: VanShift,
  role?: VanRole,
  location?: VanLocation,
}
//
// declare type VanSignupStatusString =
//   "Invited" |
//   "Scheduled" |
//   "Declined" |
//   "Confirmed" |
//   "Completed" |
//   "Walk In"

declare type VanSignupStatus =
  { statusId: 4,  name: "Invited"   } |
  { statusId: 1,  name: "Scheduled" } |
  { statusId: 3,  name: "Declined"  } |
  { statusId: 11, name: "Confirmed" } |
  { statusId: 2,  name: "Completed" } |
  { statusId: 15, name: "Walk In"   }