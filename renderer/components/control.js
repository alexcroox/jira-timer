import React from 'react'
import styled, { css } from 'styled-components'

const Control = styled.span`
  display: block;
  padding: 10px;
  color: #6B6B6B;

  &:hover {
    cursor: pointer;
    opacity: 0.8;
  }

  ${props => (props.light) && css`
    color: #FFF;
  `}

  ${props => (props.noPadding) && css`
    padding: 0;
  `}

  ${props => (props.marginRight) && css`
    margin-right: 10px;
  `}
`

export default Control
