import { useEffect, useState } from 'react';
import { Box, Button, Link, Popover, Stack, badgeClasses, paperClasses } from '@mui/material';
import { notifications as notificationsData } from 'data/notifications';
import dayjs from 'dayjs';
import paths from 'routes/paths';
import { DatewiseNotification } from 'types/notification';
import IconifyIcon from 'components/base/IconifyIcon';
import SimpleBar from 'components/base/SimpleBar';
import NotificationList from 'components/sections/notification/NotificationList';
import OutlinedBadge from 'components/styled/OutlinedBadge';

const NotificationMenu = () => {
  const [notifications, setNotifications] = useState<DatewiseNotification>({
    today: [],
    older: [],
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    // TODO: Replace with actual API call to fetch notifications
    // For now, using mock data but calculating unread count
    const datewiseNotification = notificationsData.reduce(
      (acc: DatewiseNotification, val) => {
        if (dayjs().diff(dayjs(val.createdAt), 'days') === 0) {
          acc.today.push(val);
        } else {
          acc.older.push(val);
        }
        return acc;
      },
      {
        today: [],
        older: [],
      },
    );

    setNotifications(datewiseNotification);
    // Calculate unread notifications (notifications without readAt timestamp)
    const unread = notificationsData.filter((n) => !n.readAt).length;
    setUnreadCount(unread);
  }, []);

  return (
    <>
      <Button color="neutral" variant="soft" shape="circle" onClick={handleClick}>
        {unreadCount > 0 ? (
          <OutlinedBadge
            variant="dot"
            color="error"
            sx={{
              [`& .${badgeClasses.badge}`]: {
                height: 10,
                width: 10,
                top: -2,
                right: -2,
                borderRadius: '50%',
              },
            }}
          >
            <IconifyIcon
              icon="material-symbols-light:notifications-outline-rounded"
              sx={{ fontSize: 22 }}
            />
          </OutlinedBadge>
        ) : (
          <IconifyIcon
            icon="material-symbols-light:notifications-outline-rounded"
            sx={{ fontSize: 22 }}
          />
        )}
      </Button>
      <Popover
        anchorEl={anchorEl}
        id="notification-menu"
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
          [`& .${paperClasses.root}`]: {
            width: 400,
            height: 650,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ pt: 2, flex: 1, overflow: 'hidden' }}>
          <SimpleBar disableHorizontal>
            <NotificationList
              title="Today"
              notifications={notifications.today}
              variant="small"
              onItemClick={handleClose}
            />
            <NotificationList
              title="Older"
              notifications={notifications.older}
              variant="small"
              onItemClick={handleClose}
            />
          </SimpleBar>
        </Box>
        <Stack
          sx={{
            justifyContent: 'center',
            alignItems: 'center',
            py: 1,
          }}
        >
          <Button
            component={Link}
            underline="none"
            href={paths.notifications}
            variant="text"
            color="primary"
            onClick={handleClose}
          >
            View all notifications
          </Button>
        </Stack>
      </Popover>
    </>
  );
};

export default NotificationMenu;
