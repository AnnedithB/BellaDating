import { JSX } from 'react';

export interface AccountTab {
  id?: number;
  label: string;
  title: string;
  value: string;
  icon: string;
  panelIcon: string;
  tabPanel: JSX.Element | null;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  userName?: string;
  country: string;
  city: string;
  address: string;
  zipCode: string;
  phone: string;
  phoneNumber?: string; // Legacy field for backward compatibility
  primaryEmail: string;
  secondaryEmail: string;
  avatar?: string;
}
