import React from 'react'
import ApplicationForm from './ApplicationForm'
import { OrganizerApplicationForm } from '@/templates/registrationForms'

const OrganizerApply: React.FC = () => {
  return <ApplicationForm template={OrganizerApplicationForm} applicantType="organizer" />
}

export default OrganizerApply

