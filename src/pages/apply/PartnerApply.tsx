import React from 'react'
import ApplicationForm from './ApplicationForm'
import { ManufacturingPartnerApplicationForm } from '@/templates/registrationForms'

const PartnerApply: React.FC = () => {
  return <ApplicationForm template={ManufacturingPartnerApplicationForm} applicantType="manufacturing_partner" />
}

export default PartnerApply

