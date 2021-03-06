import {VanEvent} from "../../types/VanEvent"
import {VanSignup} from "../../types/VanSignup"
import {Database} from "../index"
import {EventInstance} from "../models/event"
import {SignupInstance} from "../models/signup"
import Bluebird = require("bluebird")
import {inspect} from "util"
import {dbQueue} from "./queues"

/*********
 * SAVE
 *********/

export const saveMany = (db: Database) => async (eventTrees: VanEvent[]): Promise<EventInstance[]> => {
  return await Promise.all(eventTrees.map(save(db)))
}

export const save = (db: Database) => async (eventTree: VanEvent): Promise<EventInstance> => {
  const {actionKitId} = eventTree
  const event = await db.event.findOne({ where: { actionKitId }, ...eventIncludesOf(db) })
  return event ? updateEventTree(db)(event, eventTree) : createEventTree(db)(eventTree)
}

/*********
 * CREATE
 *********/

// TODO: wrap this in transaction
export const createEventTree = (db: Database) => async (eventTree: VanEvent): Promise<EventInstance> => {
  const event = await createEvent(db, eventTree)
  await createSignups(db, event, eventTree)
  return event
}

const createEvent = async (db: Database, eventTree: VanEvent): Promise<EventInstance> => {
  try {
    return await dbQueue.schedule(
      { priority: 1 },
      async () => db.event.create(eventTree, eventIncludesOf(db)),
    )
  } catch (err) {
    console.error(`[ERROR][AK2VAN DB CREATE EVENT][${Date.now()}]`, "Error: ", inspect(err))
  }
}

// TODO: try to use `bulkCreate` here (figure out assoc's)
const createSignups = (db: Database, event: EventInstance, eventTree: VanEvent): Array<Promise<SignupInstance>> => {
  return (eventTree.signups || []).map(async (s) => {
    return await createSignup(db, s, event)
  })
}

const createSignup = async (db: Database, signup: VanSignup, event: EventInstance): Promise<SignupInstance> => {
  try {
    return await dbQueue.schedule({ priority: 2 }, async () => db.signup.create({
      ...signup,
      eventId: event.id,
      shiftId: event.shifts[0].id || await event.getShifts().then(ss => ss[0].id),
      locationId: event.locations[0] || await event.getLocations().then(ls => ls[0].id),
    }, signupIncludesOf(db)))
  } catch (err) {
    console.error(`[ERROR][AK2VAN DB CREATE SIGNUP][${Date.now()}]`, "Error: ", inspect(err))
  }
}

/*********
 * UPDATE
 *********/

export const updateEventTree = (db: Database) => async (event: EventInstance, eventTree: VanEvent):
  Promise<EventInstance> => {
  await updateLocation(event, eventTree.locations[0])
  await updateShifts(event, eventTree)
  await event.update(eventTree)
  await updateSignups(db)(event, eventTree)
  return event
}

const updateLocation =  async (event: EventInstance, eventTreeLocation: VanLocation) => {
  const eventLocation = await event.getLocations().then(locs => locs[0])
  return await eventLocation.update(eventTreeLocation)
}

const updateShifts = (event: EventInstance, eventTree: VanEvent): Bluebird<object[]> =>
  event
    .getShifts()
    .then(
      shifts => Promise.all(shifts.map(
        async (shift, i) => await shift.update(eventTree.shifts[i])),
      ),
    )

const updateSignups = (db: Database) => (event: EventInstance, eventTree: VanEvent): Promise<any[]> =>
  Promise.all(eventTree.signups.map(updateOrCreateSignup(db, event)))

const updateOrCreateSignup = (db: Database, event: EventInstance) => async (vanSignup: VanSignup): Promise<any|any[]> => {
  const {actionKitId} = vanSignup
  const signup = await db.signup.findOne({ where: { actionKitId }, ...signupIncludesOf(db) })
  return !signup ? createSignup(db, vanSignup, event) : updateSignup(signup, vanSignup)
}

const updateSignup = async (signup: SignupInstance, vanSignup: VanSignup) => {
  await signup.update(vanSignup)
  const person = await signup.getPerson()
  await person.update(vanSignup.person)
}

/***********
 * HELPERS
 **********/

export const eventIncludesOf = (db: Database) => ({
  include: [
    { model: db.shift },
    { model: db.location },
  ],
})

const signupIncludesOf = (db: Database): object => ({
  include: [{ model: db.person }],
})
