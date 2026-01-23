import { Box, CircularProgress } from '@mui/material';

const Loading = () => {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
      <CircularProgress />
    </Box>
  );
};

export default Loading;
