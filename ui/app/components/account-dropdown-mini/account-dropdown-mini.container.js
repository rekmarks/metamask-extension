import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'

import AccountDropdownMini from './account-dropdown-mini.component'

// import actions from '../../actions'

import {
  getCurrentAccountWithSendEtherInfo,
  accountsWithSendEtherInfoSelector,
} from '../../selectors'

class AccountDropdownMiniContainer extends Component {

  static propTypes = {
    selectedAccount: PropTypes.object.isRequired,
    accounts: PropTypes.array.isRequired,
  }

  static contextTypes = {
    t: PropTypes.func,
  }

  constructor (props) {
    super(props)
    this.state = {
      selectedAccount: props.selectedAccount,
      accountDropdownOpen: false,
    }
  }

  render () {
    return (
      <AccountDropdownMini
        accounts={this.props.accounts}
        selectedAccount={this.props.selectedAccount}
        onSelect={selectedAccount => this.setState({ selectedAccount })}
        dropdownOpen={this.state.accountDropdownOpen}
        openDropdown={() => this.setState({ accountDropdownOpen: true })}
        closeDropdown={() => this.setState({ accountDropdownOpen: false })}
      />
    )
  }
}

const mapStateToProps = state => {
  return {
    selectedAccount: getCurrentAccountWithSendEtherInfo(state),
    accounts: accountsWithSendEtherInfoSelector(state),
  }
}

// const mapDispatchToProps = dispatch => {
//   return {
//     goHome: () => dispatch(actions.goHome()),
//   }
// }

export default connect(
  mapStateToProps,
  // mapDispatchToProps,
)(AccountDropdownMiniContainer)
