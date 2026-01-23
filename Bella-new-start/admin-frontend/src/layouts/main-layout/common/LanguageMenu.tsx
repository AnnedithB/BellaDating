import { SyntheticEvent, useState } from 'react';
import {
  Button,
  ListItemIcon,
  ListItemText,
  MenuItem,
  SnackbarCloseReason,
  Typography,
} from '@mui/material';
import Menu from '@mui/material/Menu';
import { languages } from 'data/languages';
import { getItemFromStore, setItemToStore } from 'lib/utils';
import IconifyIcon from 'components/base/IconifyIcon';
import ProSnackbar from './ProSnackbar';

const LANGUAGE_STORAGE_KEY = 'belle-selected-language';

const LanguageMenu = () => {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(
    getItemFromStore(LANGUAGE_STORAGE_KEY, languages[0].locale),
  );

  const menuOpen = Boolean(anchorEl);
  const currentLanguage =
    languages.find((lang) => lang.locale === selectedLanguage) || languages[0];

  const handleOpen = () => setOpen(true);
  const handleClose = (_event: SyntheticEvent, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageSelect = (locale: string) => {
    setSelectedLanguage(locale);
    setItemToStore(LANGUAGE_STORAGE_KEY, locale);
    handleOpen();
    handleMenuClose();
  };

  return (
    <>
      <Button color="neutral" variant="text" shape="circle" onClick={handleMenuOpen}>
        <IconifyIcon icon={currentLanguage.icon} sx={{ fontSize: 24 }} />
      </Button>

      <Menu
        anchorEl={anchorEl}
        id="language-menu"
        open={menuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {languages.map((language) => (
          <MenuItem
            key={language.shortLabel}
            onClick={() => handleLanguageSelect(language.locale)}
            selected={language.locale === selectedLanguage}
            sx={{ minWidth: 200 }}
          >
            <ListItemIcon>
              <IconifyIcon icon={language.icon} sx={{ fontSize: 24 }} />
            </ListItemIcon>

            <ListItemText
              primary={language.label}
              slotProps={{
                primary: { sx: { fontSize: 14 } },
              }}
            />

            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
                fontWeight: 'normal',
              }}
            >
              {language.currencySymbol}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
      <ProSnackbar open={open} onClose={handleClose} />
    </>
  );
};

export default LanguageMenu;
