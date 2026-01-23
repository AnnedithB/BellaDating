import { PropsWithChildren, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Button,
  Divider,
  ListItemIcon,
  MenuItem,
  MenuItemProps,
  Stack,
  SxProps,
  Typography,
  listClasses,
  listItemIconClasses,
  paperClasses,
} from '@mui/material';
import Menu from '@mui/material/Menu';
import paths from 'routes/paths';
import { authAPI, tokenStorage } from 'services/api';
import IconifyIcon from 'components/base/IconifyIcon';
import StatusAvatar from 'components/base/StatusAvatar';

interface ProfileMenuItemProps extends MenuItemProps {
  icon?: string;
  sx?: SxProps;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
}

const ProfileMenu = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    authAPI.logout();
    navigate(paths.login);
    handleClose();
  };

  useEffect(() => {
    const loadAdminUser = async () => {
      try {
        const token = tokenStorage.getToken();
        if (token) {
          const admin = await authAPI.getCurrentAdmin();
          if (admin) {
            setAdminUser({
              id: admin.id || '',
              email: admin.email || '',
              firstName: admin.firstName || 'Admin',
              lastName: admin.lastName || 'User',
              role: admin.role || 'ADMIN',
              avatar: admin.avatar,
            });
          }
        }
      } catch (error: any) {
        // Only log if it's not a connection/timeout error
        if (
          !error.message?.includes('Unable to connect') &&
          !error.message?.includes('timeout') &&
          !error.message?.includes('404')
        ) {
          console.error('Failed to load admin user:', error);
        }
      }
    };

    loadAdminUser();
  }, []);

  const displayName = adminUser
    ? `${adminUser.firstName} ${adminUser.lastName}`.trim() || adminUser.email
    : 'Guest';
  const displayRole = adminUser?.role || 'Guest';

  const menuButton = (
    <Button
      color="neutral"
      variant="text"
      shape="circle"
      onClick={handleClick}
      sx={{
        height: 44,
        width: 44,
      }}
    >
      <StatusAvatar
        alt={displayName}
        status={adminUser ? 'online' : 'offline'}
        src={adminUser?.avatar}
        sx={{
          width: 40,
          height: 40,
          border: 2,
          borderColor: 'background.paper',
          bgcolor: adminUser?.avatar ? 'transparent' : 'primary.main',
        }}
      >
        {!adminUser?.avatar && displayName.charAt(0).toUpperCase()}
      </StatusAvatar>
    </Button>
  );
  return (
    <>
      {menuButton}
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        transformOrigin={{
          horizontal: 'right',
          vertical: 'top',
        }}
        anchorOrigin={{
          horizontal: 'right',
          vertical: 'bottom',
        }}
        sx={{
          [`& .${paperClasses.root}`]: { minWidth: 320 },
          [`& .${listClasses.root}`]: { py: 0 },
        }}
      >
        <Stack
          sx={{
            alignItems: 'center',
            gap: 2,
            px: 3,
            py: 2,
          }}
        >
          <StatusAvatar
            status={adminUser ? 'online' : 'offline'}
            alt={displayName}
            src={adminUser?.avatar}
            sx={{
              width: 48,
              height: 48,
              bgcolor: adminUser?.avatar ? 'transparent' : 'primary.main',
            }}
          >
            {!adminUser?.avatar && displayName.charAt(0).toUpperCase()}
          </StatusAvatar>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                mb: 0.5,
              }}
            >
              {displayName}
            </Typography>
            {displayRole && displayRole !== 'Guest' && (
              <Typography
                variant="subtitle2"
                sx={{
                  color: 'warning.main',
                  textTransform: 'capitalize',
                }}
              >
                {displayRole.replace(/_/g, ' ')}
                <IconifyIcon
                  icon="material-symbols:diamond-rounded"
                  color="warning.main"
                  sx={{ verticalAlign: 'text-bottom', ml: 0.5 }}
                />
              </Typography>
            )}
            {adminUser?.email && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                  display: 'block',
                }}
              >
                {adminUser.email}
              </Typography>
            )}
          </Box>
        </Stack>
        <Divider />
        <Box sx={{ py: 1 }}>
          <ProfileMenuItem
            icon="material-symbols:manage-accounts-outline-rounded"
            onClick={() => {
              navigate(paths.account);
              handleClose();
            }}
          >
            Account Settings
          </ProfileMenuItem>
        </Box>
        <Divider />
        <Box sx={{ py: 1 }}>
          {adminUser ? (
            <ProfileMenuItem onClick={handleLogout} icon="material-symbols:logout-rounded">
              Sign Out
            </ProfileMenuItem>
          ) : (
            <ProfileMenuItem
              onClick={() => {
                navigate(paths.login);
                handleClose();
              }}
              icon="material-symbols:login-rounded"
            >
              Sign In
            </ProfileMenuItem>
          )}
        </Box>
      </Menu>
    </>
  );
};

const ProfileMenuItem = ({
  icon,
  onClick,
  children,
  sx,
}: PropsWithChildren<ProfileMenuItemProps>) => {
  return (
    <MenuItem onClick={onClick} sx={{ gap: 1, ...sx }}>
      {icon && (
        <ListItemIcon
          sx={{
            [`&.${listItemIconClasses.root}`]: { minWidth: 'unset !important' },
          }}
        >
          <IconifyIcon icon={icon} sx={{ color: 'text.secondary' }} />
        </ListItemIcon>
      )}
      {children}
    </MenuItem>
  );
};

export default ProfileMenu;
