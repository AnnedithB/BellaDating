import { AccountTab } from 'types/accounts';
import PersonalInfoTabPanel from 'components/sections/account/personal-info/PersonalInfoTabPanel';

export const accountTabs: AccountTab[] = [
  {
    id: 1,
    label: 'Personal Information',
    title: 'Personal Info',
    value: 'personal_information',
    icon: 'material-symbols:person-outline',
    panelIcon: 'material-symbols:person-outline',
    tabPanel: <PersonalInfoTabPanel />,
  },
];
