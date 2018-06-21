import axios from "axios"
import * as _ from "lodash"
import {Subject} from "rxjs/Subject"
import config from "../../config/"
const {secrets} = config

export const actionKitSubject = new Subject()

const api = () => {
  return axios.create({
    baseURL: secrets.actionKitAPI.baseUrl,
    auth: {
      username: secrets.actionKitAPI.username,
      password: secrets.actionKitAPI.password,
    },
  })
}

const getResource = async (resourceUrl: string, responsePath: string[]) => {
  // TODO (aguestuser|20 Jun 2018): PAGINATION
  // - we do not currently follow pagination redirects for any resources
  // - we should follow them for *all* resources, likely here
  try {
    const response = await api().get(resourceUrl)
    return _.get(response, responsePath)
  } catch (error) {
    console.error(error)
  }
}

export const getEvents = async (eventsUrl) => {
  return getResource(eventsUrl, ["data", "objects"])
}

export const getEventSignups = (eventSignupUrls) => {
  return eventSignupUrls.map(getEventSignup)
}

export const getEventSignup = (eventSignupUrl: string) => {
  return getResource(eventSignupUrl, ["data"])
}

export const getUsers = (userUrls) => {
  return userUrls.map(getUser)
}

export const getUser = (userUrl: string) => {
  return getResource(userUrl, ["data"])
}

export const getPhones = async (phoneUrls) => {
  return await Promise.all(phoneUrls.map(async (phoneUrl) => {
    return await getPhone(phoneUrl)
  }))
}

export const getPhone = async (phoneUrl: string) => {
  return await getResource(phoneUrl, ["data"])
}

export const getResources = async () => {
  // TODO (aguestuser|20 Jun 2018): refactor
  // - rip out rxjs
  // - tweak logic a touch (could parallelize over all events, not just signups)
  const events = await getEvents(secrets.actionKitAPI.campaignEndpoint)

  events.map( async (event) => {
    const eventSignups = await Promise.all(event.signups.map( async (signupUrl) => {
      const eventSignup = await getEventSignup(signupUrl)
      const user = await getUser(eventSignup.user)
      const phones = await getPhones(user.phones)

      return { ...eventSignup, user: {...user, phones } }
    }))

    const resourceTree = { ...event, signups: eventSignups }
    actionKitSubject.next(resourceTree)
  })
}