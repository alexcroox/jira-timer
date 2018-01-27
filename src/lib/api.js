import request from 'request-promise'
import keychain from 'keytar'
import store from './create-store'
import { setAuthToken, userLogout } from '../modules/user'

class Api {

  constructor () {

    let baseUrl = null
    this.authToken = null

    this.request = request.defaults({
      baseUrl: null,
      timeout: 20000,
      json: true,
      simple: true
    })

    this.getCredentialsFromKeyChain()
      .then(credentials => {
        console.log('Creds', credentials)
        this.authToken = credentials.password
        this.setAuthHeaders(this.authToken, credentials.account)
        store.dispatch(setAuthToken(this.authToken))
      })
      .catch(error => console.log('New user'))
  }

  get (urlPath) {
    return this.send('GET', urlPath)
  }

  post (urlPath, data) {
    return this.send('POST', urlPath, data)
  }

  put (urlPath, data) {
    return this.send('PUT', urlPath, data)
  }

  delete (urlPath, data) {

    console.warn('Deleting', urlPath)

    return this.send('DELETE', urlPath)
  }

  send (method, urlPath, data = '') {
    return new Promise((resolve, reject) => {

      console.log('Api call', urlPath, this.authToken)

      this.request({
        url: urlPath,
        method: method,
        body: data
      })
        .then(response => resolve(response))
        .catch(error => {
          // We need to get the user to login again
          if (error.statusCode === 401)
            store.dispatch(userLogout())

          reject(error)
        })
    })
  }

  login (username, password, authUrl) {
    return new Promise((resolve, reject) => {

      // Convert username/password to base64
      this.authToken = this.b64Encode(`${username}:${password}`)

      this.setAuthHeaders(this.authToken, authUrl)

      // Test an endpoint with this auth token
      this.isLoggedIn(true)
        .then(response => {

          console.log('Setting token', response)

          store.dispatch(setAuthToken(this.authToken))
          keychain.setPassword('jira-timer', authUrl, this.authToken)

          resolve(response)
        })
        .catch(error => reject(error))
    })
  }

  isLoggedIn (login = false) {
    return new Promise((resolve, reject) => {

      if (!login)
        this.getCredentialsFromKeyChain()
          .then(credentials => {

            this.authToken = credentials.password

            this.setAuthHeaders(this.authToken, credentials.account)

            this.get('/myself')
              .then(response => {
                resolve(response)
              })
              .catch(error => {
                // We need to get the user to login again
                store.dispatch(userLogout())
                reject(error)
              })
          })
          .catch(error => reject(error))
      else
        this.get('/myself')
          .then(response => resolve(response))
          .catch(error => reject(error))
    })
  }

  setAuthHeaders (authToken, authUrl) {
    this.request = this.request.defaults({
      baseUrl: `https://${authUrl}/rest/api/2`,
      headers: {
        'Authorization': `Basic ${this.authToken}`,
      }
    })
  }

  getCredentialsFromKeyChain () {
    return new Promise((resolve, reject) => {
      keychain.findCredentials('jira-timer')
        .then(credentials => resolve(credentials[0]))
        .catch(error => reject(error))
    })
  }

  b64Encode (str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }))
  }
}

export default new Api()
