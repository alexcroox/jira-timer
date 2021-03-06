import { remote, ipcRenderer } from 'electron'
import React, { Component, Fragment } from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import throttle from 'lodash.throttle'
import parseDuration from 'parse-duration'
import { formatSecondsToStopWatch, roundToNearestMinutes, secondsHuman } from '../../lib/time'
import { openInJira } from '../../lib/jira'
import getTaskTransitions from '../../lib/get-task-transitions'
import { deleteTimer, pauseTimer, postTimer, updateTimer, updateComment, setCommenting } from '../../modules/timer'
import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import faPlay from '@fortawesome/fontawesome-free-solid/faPlay'
import faPause from '@fortawesome/fontawesome-free-solid/faPause'
import faSpinner from '@fortawesome/fontawesome-free-solid/faSpinner'
import faUpload from '@fortawesome/fontawesome-free-solid/faUpload'
import { TaskTitle, TaskAction, TaskSummary } from '../../components/task'
import Control from '../../components/control'
import OptionDots from '../../components/option-dots'
import EditTime from '../../components/edit-time'
import EditComment from '../../components/edit-comment'

class TimerContainer extends Component {
  constructor (props) {
    super(props)

    this.renderTime = true
    this.state = {
      timers: [],
      postingHumanTime: 0,
      editingTimer: null,
      editingComment: null,
      loadingTransitions: false
    }

    this.displayTimers = this.displayTimers.bind(this)
    this.onTimeChanged = this.onTimeChanged.bind(this)
    this.onEditTime = this.onEditTime.bind(this)
    this.onResetEditTime = this.onResetEditTime.bind(this)
    this.onEditComment = throttle(this.onEditComment.bind(this), 1000)
    this.onResetEditComment = this.onResetEditComment.bind(this)
    this.onCommentSaved = this.onCommentSaved.bind(this)
    this.onPlay = this.onPlay.bind(this)
  }

  componentDidMount () {
    this.displayTimers()
    this.renderTime = true
  }

  componentWillUnmount () {
    console.warn('Unmounting')
    this.renderTime = false
  }

  onPlay (timerId) {
    this.onResetEditTime()
    this.props.pauseTimer(timerId, false)
  }

  displayTimers () {

    if (!this.renderTime)
      return

    let firstRunningTimer = null

    let timers = this.props.timers.map(reduxTimer => {

      let timer = {...reduxTimer}

      let timeInMs = timer.previouslyElapsed

      if (!timer.paused) {
        timeInMs = (Date.now() - timer.startTime) + timer.previouslyElapsed

        if (!firstRunningTimer)
          firstRunningTimer = timer
      }

      let timeInSeconds = Math.round(timeInMs/1000)
      timer.stopWatchDisplay = formatSecondsToStopWatch(timeInSeconds)
      timer.menubarDisplay = formatSecondsToStopWatch((roundToNearestMinutes(timeInSeconds,1) - 1) * 60, 'hh:mm')
      timer.realTimeSecondsElapsed = timeInSeconds

      return timer
    })

    let titleUpdate = ''

    if (!this.props.settings.menubarHideTiming)
      titleUpdate = 'Idle'

    if (timers.length) {

      // Update our menu bar title with the time of the first unpaused timer
      if (firstRunningTimer) {
        titleUpdate = ``

        if (!this.props.settings.menubarHideKey)
          titleUpdate += firstRunningTimer.key

        if (!this.props.settings.menubarHideTiming)
          titleUpdate += ` ${firstRunningTimer.menubarDisplay}`
      }

      this.setState({
        timers
      })
    }

    ipcRenderer.send('updateTitle', {
      title: titleUpdate,
      timerRunning: firstRunningTimer !== null
    })

    if (this.renderTime)
      setTimeout(this.displayTimers, 500)
  }

  onEditTime (timerId) {
    this.props.pauseTimer(timerId, true)

    this.setState({ editingTimer: timerId })
  }

  onTimeChanged (timerId, editedTime) {
    if (editedTime != '') {
      let ms = parseDuration(editedTime)

      // Is the timer entered valid?
      if (ms > 0)
        this.props.updateTimer(timerId, ms)
    }

    this.onResetEditTime()
  }

  onResetEditTime () {
    this.setState({ editingTimer: null })
    this.props.setCommenting(false)
  }

  onEditComment (timer) {

    // Has the user disabled comments in the settings?
    // If so then just post the timer
    if (!this.props.settings.commentBlock)
      return this.props.postTimer(timer)

    if (this.state.editingComment !== null)
      this.props.pauseTimer(this.state.editingComment, false)

    this.props.pauseTimer(timer.id, true)

    let nearestMinutes = roundToNearestMinutes(timer.realTimeSecondsElapsed)
    let humanTime = secondsHuman(nearestMinutes * 60)
    this.setState({ editingComment: timer.id, postingHumanTime: humanTime })
    this.props.setCommenting(true)
  }

  onCommentSaved (timer, comment) {
    this.props.updateComment(timer.id, comment)
    this.onResetEditComment(timer.id)
    this.props.postTimer(timer)
  }

  onResetEditComment (timerId) {
    if (this.state.editingComment === timerId) {
      this.setState({ editingComment: null })
      this.props.setCommenting(false)
    }

    this.props.pauseTimer(timerId, false)
  }

  onOpenOptions = async (timer) => {
    const { Menu, MenuItem } = remote

    let nearestMinutes = roundToNearestMinutes(timer.realTimeSecondsElapsed)
    let humanTime = secondsHuman(nearestMinutes * 60)

    const menu = new Menu()

    menu.append(new MenuItem({
      label: `Post ${humanTime} to JIRA`,
      click: () => { this.onEditComment(timer) },
      enabled: !timer.posting
    }))

    let jiraSubMenu = [{
      label: 'Open in JIRA',
      click() { openInJira(timer.key) }
    }]

    this.setState({ loadingTransitions: true })

    try {
      let transitions = await getTaskTransitions(timer.key)

      jiraSubMenu.push({
        label: `Transition status`,
        submenu: transitions
      })

      this.setState({ loadingTransitions: false })
    } catch (error) {
      this.setState({ loadingTransitions: false })
    }

    menu.append(new MenuItem({
      label: 'JIRA',
      submenu: jiraSubMenu
    }))

    menu.append(new MenuItem({
      label: 'Edit time',
      click: () => { this.onEditTime(timer.id) }
    }))

    menu.append(new MenuItem({
      label: 'Delete timer',
      click: () => { this.props.deleteTimer(timer.id) }
    }))

    menu.popup({})
  }

  render () {
    if (this.props.timers.length && !this.props.hideTimers)
      return (
        <div>
          {this.state.timers.map(timer => (
            <Fragment key={timer.id}>
              {this.state.editingComment === timer.id ? (
                <EditComment
                  key={timer.id}
                  timer={timer}
                  postingHumanTime={this.state.postingHumanTime}
                  onCommentSaved={this.onCommentSaved}
                  onResetEditComment={this.onResetEditComment}
                  placeholder={`What were you working on for ${this.state.postingHumanTime}?\nShift + ⏎ for new line\n⏎ to post, Esc to cancel`}
                />
              ) : (
                <TimerWrapper key={timer.id}>
                  {timer.posting ? (
                    <Control light>
                      <FontAwesomeIcon icon={faSpinner} spin />
                    </Control>
                  ) : (
                    <Fragment>
                      {timer.paused ? (
                        <Control light onClick={() => this.onPlay(timer.id)}>
                          <FontAwesomeIcon icon={faPlay} />
                        </Control>
                      ) : (
                        <Control light onClick={() => this.props.pauseTimer(timer.id, true)}>
                          <FontAwesomeIcon icon={faPause} />
                        </Control>
                      )}
                    </Fragment>
                  )}

                  <Time>
                    {this.state.editingTimer === timer.id ? (
                      <EditTime
                        timeId={timer.id}
                        onTimeChanged={this.onTimeChanged}
                        onResetEditTime={this.onResetEditTime}
                        placeholder={secondsHuman(Math.round(timer.previouslyElapsed / 1000))}
                      />
                    ) : (
                      <span onClick={() => this.onEditTime(timer.id)}>
                        {timer.stopWatchDisplay}
                      </span>
                    )}
                  </Time>

                  <TaskTitle>
                    <span>{`${timer.key} `}</span>
                    <TaskSummary>{timer.summary}</TaskSummary>
                  </TaskTitle>

                  <TaskAction>
                    <FontAwesomeIcon
                      onClick={() => this.onEditComment(timer)}
                      icon={faUpload}
                    />
                  </TaskAction>

                  <OptionDots
                    loading={this.state.loadingTransitions}
                    onClick={() => this.onOpenOptions(timer)}
                    onContextMenu={() => this.onOpenOptions(timer)}
                  />
                </TimerWrapper>
              )}
            </Fragment>
          ))}
        </div>
      )
    else return (null)
  }
}

const TimerWrapper = styled.div`
  padding: 0 15px 0 4px;
  background: #2E87FB;
  color: #FFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #4EADFA;
  position: relative;

  &:first-child {
    border-top: none;
  }
`

const Time = styled.span`
  font-weight: 500;
  letter-spacing: 0.04em;
  background-color: #0049C5;
  padding: 3px 10px 4px;
  border-radius: 5px;
  margin-right: 15px;
  margin-left: 5px;
`

const mapDispatchToProps = {
  deleteTimer,
  pauseTimer,
  postTimer,
  updateTimer,
  updateComment,
  setCommenting
}

const mapStateToProps = state => ({
  timers: state.timer.list,
  settings: state.settings
})

export default connect(mapStateToProps, mapDispatchToProps)(TimerContainer)
