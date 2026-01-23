import { SyntheticEvent, useState } from 'react';
import { TabContext } from '@mui/lab';
import { Box, CircularProgress, Container, Drawer, Paper, Stack } from '@mui/material';
import { accountTabs } from 'data/account/account-tabs';
import AccountsProvider, { useAccounts } from 'providers/AccountsProvider';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import SimpleBar from 'components/base/SimpleBar';
import SideTabList from 'components/sections/account/SideTabList';
import AccountTabPanel from 'components/sections/account/common/AccountTabPanel';

const AccountContent = () => {
  const [activeTab, setActiveTab] = useState(accountTabs[0].value);
  const { down } = useBreakpoints();
  const [showTabList, setShowTabList] = useState(true);
  const { loading } = useAccounts();

  const downMd = down('md');
  const handleChange = (_event: SyntheticEvent, newValue: string): void => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <TabContext value={activeTab}>
      <Stack>
        {downMd ? (
          <Drawer
            hideBackdrop
            open={showTabList}
            onClose={() => setShowTabList(false)}
            ModalProps={{
              keepMounted: true,
              disablePortal: true,
            }}
            slotProps={{
              paper: {
                sx: {
                  bgcolor: 'background.elevation1',
                  width: 1,
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                  height: { xs: 'calc(100vh - 64px)', md: 'calc(100vh - 82px)' },
                  top: { xs: 65, md: 83 },
                },
              },
            }}
            sx={{
              pointerEvents: 'none',
            }}
          >
            <SimpleBar>
              <SideTabList setShowTabList={setShowTabList} handleChange={handleChange} />
            </SimpleBar>
          </Drawer>
        ) : (
          <Paper
            background={1}
            sx={{
              width: { md: 324, lg: 405 },
              position: 'sticky',
              top: { xs: 64, md: 82 },
              height: { xs: 'calc(100vh - 64px)', md: 'calc(100vh - 82px)' },
            }}
          >
            <SimpleBar>
              <SideTabList setShowTabList={setShowTabList} handleChange={handleChange} />
            </SimpleBar>
          </Paper>
        )}

        <Paper sx={{ flex: 1, maxWidth: 1 }}>
          <Container
            maxWidth={false}
            sx={{
              px: { xs: 3, md: 5 },
              py: 5,
              maxWidth: { xs: 628, md: 660 },
              overflowY: 'hidden',
              height: downMd ? 1 : 'auto',
            }}
          >
            {accountTabs.map((tab) => (
              <AccountTabPanel
                key={tab.id}
                label={tab.label}
                value={tab.value}
                title={tab.title}
                panelIcon={tab.panelIcon}
                setShowTabList={setShowTabList}
              >
                {tab.tabPanel}
              </AccountTabPanel>
            ))}
          </Container>
        </Paper>
      </Stack>
    </TabContext>
  );
};

const Account = () => {
  return (
    <AccountsProvider>
      <AccountContent />
    </AccountsProvider>
  );
};

export default Account;
