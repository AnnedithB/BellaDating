import { PropsWithChildren, createContext, use, useEffect, useState } from 'react';
import { authAPI } from 'services/api';
import { PersonalInfo } from 'types/accounts';

interface AccountsContextInterface {
  personalInfo: PersonalInfo;
  loading: boolean;
  updatePersonalInfo: (updates: Partial<PersonalInfo>) => Promise<void>;
}

export const AccountsContext = createContext({} as AccountsContextInterface);

const AccountsProvider = ({ children }: PropsWithChildren) => {
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    primaryEmail: '',
    secondaryEmail: '',
    phone: '',
    address: '',
    country: '',
    city: '',
    zipCode: '',
    avatar: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const admin = await authAPI.getCurrentAdmin();
        setPersonalInfo({
          firstName: admin.firstName || '',
          lastName: admin.lastName || '',
          primaryEmail: admin.email || '',
          secondaryEmail: admin.secondaryEmail || '',
          phone: admin.phone || '',
          address: admin.address || '',
          country: admin.country || '',
          city: admin.city || '',
          zipCode: admin.zipCode || '',
          avatar: admin.avatar || '',
        });
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, []);

  const updatePersonalInfo = async (updates: Partial<PersonalInfo>) => {
    try {
      // TODO: Add API endpoint to update admin profile
      // For now, just update local state
      setPersonalInfo((prev) => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Failed to update personal info:', error);
      throw error;
    }
  };

  return (
    <AccountsContext
      value={{
        personalInfo,
        loading,
        updatePersonalInfo,
      }}
    >
      {children}
    </AccountsContext>
  );
};

export const useAccounts = () => use(AccountsContext);

export default AccountsProvider;
