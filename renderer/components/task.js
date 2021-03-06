import { remote } from 'electron'
import React, { Component } from 'react'
import styled, { css } from 'styled-components'
import PropTypes from 'prop-types'
import { openInJira } from '../lib/jira'
import getTaskTransitions from '../lib/get-task-transitions'

class Task extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loadingTransitions: false
    }
  }

  onContextMenu = async (taskKey) => {
    const { Menu, MenuItem } = remote

    this.setState({ loadingTransitions: true })

    const menu = new Menu()

    menu.append(new MenuItem({
      label: `Open ${taskKey} in JIRA`,
      click() { openInJira(taskKey) }
    }))

    try {
      let transitions = await getTaskTransitions(taskKey)

      this.setState({ loadingTransitions: false })

      menu.append(new MenuItem({
        label: `Transition status`,
        submenu: transitions
      }))

      this.openMenu(menu)
    } catch (error) {
      this.setState({ loadingTransitions: false })
      this.openMenu(menu)
    }
  }

  openMenu = menu => {
    menu.popup({})
  }

  render() {
    return (
      <TaskWrapper
        loading={this.state.loadingTransitions}
        highlighted={this.props.highlighted}
        hasTimer={this.props.hasTimer}
        onClick={this.props.onAddTimer}
        onContextMenu={() => { this.onContextMenu(this.props.taskKey, this.props.projectTransitions) }}
      >
        <TaskTitle>{this.props.title}</TaskTitle>
        <TaskKey>{this.props.taskKey}</TaskKey>
      </TaskWrapper>
    )
  }
}

Task.propTypes = {
  title: PropTypes.string.isRequired,
  taskKey: PropTypes.string.isRequired
}

export const TaskContainer = styled.div`
  overflow: auto;

  ${props => (props.maxHeight) && css`
    max-height: 331px;
  `}
`

const TaskWrapper = styled.div`
  border-top: 1px solid ${props => props.theme.darkMode ? props.theme.dark.tableRow : 'rgba(234,234,234,0.8)' };
  background-color: ${props => props.theme.darkMode ? props.theme.dark.tableRow : '#FFF' };
  padding: 10px 12px;
  display: flex;
  align-items: center;
  color: ${props => props.theme.darkMode ? props.theme.dark.color : 'inherit' };

  &:nth-child(even) {
    background-color: ${props => props.theme.darkMode ? props.theme.dark.tableRowAlt : 'rgba(234,234,234,0.4)' };
  }

  &:first-child {
    border-top: none;
  }

  &:hover {
    cursor: ${props => props.loading ? 'progress' : 'pointer' };
    background-color: ${props => props.theme.darkMode ? props.theme.dark.backgroundColor : 'rgba(35,129,250,0.1)' };
  }

  ${props => (props.highlighted) && css`
    background-color: #2E87FB;
    color: #FFF;

    &:nth-child(even) {
      background-color: #2E87FB;
    }

    &:hover {
      cursor: pointer;
      background-color: #0049C5
    }

    & > ${TaskKey} {
      color: #FFF;
    }
  `}
`

const TaskKey = styled.span`
  font-weight: 500;
  color: #666;
  margin-right: 5px;
`

export const TaskTitle = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  display: flex;
  align-items: center;
  margin-right: 10px;

  ${props => (props.light) && css`
    color: #FFF;
  `}
`

export const TaskSummary = styled.span`
  margin-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const TaskAction = styled.span`
  margin-left: 15px;

  &:hover {
    cursor: pointer;
  }
`

export default Task
