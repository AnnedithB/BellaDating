import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import paths from 'routes/paths';
import { knowledgeBaseAPI } from 'services/api';
import PageHeader from 'components/sections/user-table/PageHeader';

const Articles = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    category: '',
    tags: [] as string[],
    isPublished: false,
  });

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const response = await knowledgeBaseAPI.getArticles();
      setArticles(response?.data || []);
    } catch (err: any) {
      console.error('Failed to load articles:', err);
      // Don't show error if backend is not running - just show empty state
      if (err.message?.includes('connect')) {
        setArticles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = () => {
    setEditMode(false);
    setSelectedArticle(null);
    setFormData({
      title: '',
      content: '',
      summary: '',
      category: '',
      tags: [],
      isPublished: false,
    });
    setArticleDialogOpen(true);
  };

  const handleEditArticle = (article: any) => {
    setEditMode(true);
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      summary: article.summary || '',
      category: article.category,
      tags: article.tags || [],
      isPublished: article.isPublished,
    });
    setArticleDialogOpen(true);
  };

  const handleSaveArticle = async () => {
    try {
      if (editMode && selectedArticle) {
        await knowledgeBaseAPI.updateArticle(selectedArticle.id, formData);
      } else {
        await knowledgeBaseAPI.createArticle(formData);
      }
      setArticleDialogOpen(false);
      loadArticles();
    } catch (err: any) {
      console.error('Failed to save article:', err);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;

    try {
      await knowledgeBaseAPI.deleteArticle(id);
      loadArticles();
    } catch (err: any) {
      console.error('Failed to delete article:', err);
    }
  };

  const handlePublishToggle = async (id: string, isPublished: boolean) => {
    try {
      await knowledgeBaseAPI.publishArticle(id, !isPublished);
      loadArticles();
    } catch (err: any) {
      console.error('Failed to toggle publish status:', err);
    }
  };

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Title', width: 300 },
    { field: 'category', headerName: 'Category', width: 150 },
    {
      field: 'isPublished',
      headerName: 'Published',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    { field: 'viewCount', headerName: 'Views', width: 100 },
    { field: 'createdAt', headerName: 'Created', width: 180 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => handleEditArticle(params.row)}>
            Edit
          </Button>
          <Button
            size="small"
            variant={params.row.isPublished ? 'outlined' : 'contained'}
            onClick={() => handlePublishToggle(params.row.id, params.row.isPublished)}
          >
            {params.row.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
          <Button size="small" color="error" onClick={() => handleDeleteArticle(params.row.id)}>
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Knowledge Base"
        breadcrumb={[
          { label: 'Home', url: paths.root },
          { label: 'Knowledge Base', active: true },
        ]}
        actionComponent={
          <Button variant="contained" onClick={handleCreateArticle}>
            Create Article
          </Button>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <DataGrid
          rows={articles}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
        />
      </Paper>

      <Dialog
        open={articleDialogOpen}
        onClose={() => setArticleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editMode ? 'Edit Article' : 'Create Article'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Summary"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              multiline
              rows={10}
              required
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                />
              }
              label="Published"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArticleDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveArticle}
            variant="contained"
            disabled={!formData.title || !formData.content}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Articles;
