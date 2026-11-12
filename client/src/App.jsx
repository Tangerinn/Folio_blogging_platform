import { Route, Routes } from 'react-router-dom';
import StudentLayout from './layouts/StudentLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import Home from './pages/student/Home.jsx';
import Explore from './pages/student/Explore.jsx';
import BlogPost from './pages/student/BlogPost.jsx';
import CreateEditBlog from './pages/student/CreateEditBlog.jsx';
import MyPosts from './pages/student/MyPosts.jsx';
import Profile from './pages/student/Profile.jsx';
import SavedPosts from './pages/student/SavedPosts.jsx';
import Notifications from './pages/student/Notifications.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Users from './pages/admin/Users.jsx';
import Moderation from './pages/admin/Moderation.jsx';
import Categories from './pages/admin/Categories.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        {/* public */}
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/posts/:id" element={<BlogPost />} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* signed in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/write" element={<CreateEditBlog />} />
          <Route path="/posts/:id/edit" element={<CreateEditBlog />} />
          <Route path="/my-posts" element={<MyPosts />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/saved" element={<SavedPosts />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* admin only */}
      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/moderation" element={<Moderation />} />
          <Route path="/admin/categories" element={<Categories />} />
        </Route>
      </Route>
    </Routes>
  );
}
