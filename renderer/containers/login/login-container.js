import React, { Component, Fragment } from 'react'
import { shell } from 'electron'
import { connect } from 'react-redux'
import { Redirect } from 'react-router-dom'
import styled from 'styled-components'
import { FooterWrapper } from '../footer/footer-container'
import FormContainer from '../../components/form-container'
import Header from '../../components/header'
import ErrorMessage from '../../components/error'
import LoginForm from './login-form'
import passwordValidationRule from '../../validation/password-validation'
import { isNotEmpty } from '../../validation/helpers'
import { userLogin } from '../../modules/user'
import Page from '../../components/page'

const validationRules = {
  authUrl: [
    [isNotEmpty, 'What is your JIRA Url?']
  ],
  username: [
    [isNotEmpty, 'What is your JIRA Username?']
  ],
  password: [
    [isNotEmpty, 'What is your JIRA account password?']
  ],
}

class LoginContainer extends Component {
  constructor (props) {
    super(props)

    this.state = {
      form: {
        authUrl: 'sidigital.atlassian.net',
        username: '',
        password: ''
      }
    }

    this.onLogin = this.onLogin.bind(this)
  }

  onLogin = (formResponse) => {
    if (this.props.loginPending)
      return false

    this.setState({ form: formResponse.form })

    if (formResponse.valid)
      this.props.login(formResponse.form)
  }

  render () {
    return (
      <Page>
        {this.props.authToken && (
          <Redirect to="/dashboard" />
        )}

        <Header titleText="Login to JIRA" />

        <FormContainer>
          {this.props.loginError && (
            <ErrorMessage>Those details didn't work, try again</ErrorMessage>
          )}

          <LoginForm
            onSubmit={this.onLogin}
            initialState={this.state.form}
            rules={validationRules}
            validateOnChange={false}
            submitting={this.props.loginPending}
          />
        </FormContainer>

        <FooterWrapper>
          <Credits>created by Si digital</Credits>
        </FooterWrapper>
      </Page>
    );
  }
}

const Credits = styled.div`
  text-align: right;
  width: 100%;
`

const mapDispatchToProps = dispatch => {
  return {
    login: (formData) => {
      const { username, password, authUrl } = formData
      dispatch(userLogin(username, password, authUrl))
    }
  }
}

const mapStateToProps = state => ({
  loginError: state.user.loginError,
  loginPending: state.user.loginPending,
  authToken: state.user.authToken,
})

export default connect(mapStateToProps, mapDispatchToProps)(LoginContainer)
