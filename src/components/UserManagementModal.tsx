import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AppModal } from './AppModal';
import {
  X,
  UserPlus,
  Shield,
  UserCheck,
  Wrench,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Check,
} from 'lucide-react';

interface UserItem {
  id: number;
  email: string;
  full_name: string;
  role: 'rpm' | 'inspector' | 'admin' | string;
  is_active: boolean;
  created_at?: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Form State
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<'rpm' | 'inspector' | 'admin'>('rpm');
  const [password, setPassword] = useState<string>('password123');

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<'rpm' | 'inspector' | 'admin'>('rpm');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'accounts' | 'add'>('accounts');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserItem | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setActiveTab('accounts');
      setEditingUser(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 1. CREATE USER
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError('Please provide full name and email.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        role: role,
        password: password.trim() || 'password123',
        is_active: true,
      });

      showToast(`User ${fullName} (${role.toUpperCase()}) created successfully!`);
      setFullName('');
      setEmail('');
      setPassword('password123');
      await fetchUsers();
      setActiveTab('accounts');
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. OPEN EDIT USER
  const startEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditFullName(u.full_name);
    setEditEmail(u.email);
    setEditRole((u.role as any) || 'rpm');
    setEditIsActive(u.is_active);
    setEditPassword('');
  };

  // 3. SAVE EDIT USER
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFullName.trim() || !editEmail.trim()) {
      setError('Name and Email are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
        is_active: editIsActive,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      await api.updateUser(editingUser.id, payload);
      showToast(`User ${editFullName} updated successfully!`);
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. TOGGLE ACTIVE STATUS
  const handleToggleActive = async (u: UserItem) => {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      showToast(`User ${u.full_name} is now ${!u.is_active ? 'Active' : 'Inactive'}`);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status');
    }
  };

  // 5. DELETE USER
  const confirmDeleteUser = async (u: UserItem) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.deleteUser(u.id);
      showToast(`User ${u.full_name} deleted.`);
      if (editingUser?.id === u.id) {
        setEditingUser(null);
      }
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmUser(null);
    }
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole?.toLowerCase()) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3 h-3 text-purple-600" /> Admin
          </span>
        );
      case 'inspector':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <UserCheck className="w-3 h-3 text-blue-600" /> Inspector
          </span>
        );
      case 'rpm':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Wrench className="w-3 h-3 text-emerald-600" /> RPM User
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm flex justify-center items-start sm:items-center min-h-screen animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">User Management</h2>
              <p className="text-xs text-slate-300">Admin Control • Manage RPM, Inspector & Admin accounts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('accounts');
              setEditingUser(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accounts' && !editingUser
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>System Accounts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              {users.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('add');
              setEditingUser(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add New User</span>
          </button>
          {editingUser && (
            <span className="pb-2.5 px-3 text-xs font-bold border-b-2 border-purple-600 text-purple-700 flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editing: {editingUser.full_name}</span>
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* EDIT USER FORM */}
          {editingUser && (
            <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-purple-600" />
                    <span>Edit User Account: {editingUser.full_name}</span>
                  </h3>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Update user name, role permissions, active status, or reset password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-700 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-700 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Role / Permissions <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                      className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-700 cursor-pointer shadow-sm"
                    >
                      <option value="rpm">RPM User (Fill & Submit Form)</option>
                      <option value="inspector">Inspector (Verify & Sign-off)</option>
                      <option value="admin">Admin (Form Structure & Users)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Leave empty to keep current password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-700 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Account Active (Can log in)</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-purple-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-800 text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 1: ADD NEW USER */}
          {activeTab === 'add' && !editingUser && (
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm animate-in fade-in duration-150">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Create System Account</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter details to register a new RPM Technician, Inspector, or Admin.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sjenkins@maxwell.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Role / Permissions <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-sm"
                    >
                      <option value="rpm">RPM User (Fill & Submit Form)</option>
                      <option value="inspector">Inspector (Verify & Sign-off)</option>
                      <option value="admin">Admin (Form Structure & Users)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Default Password <span className="text-slate-400 font-normal">(Changeable)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Default: password123"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('accounts')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating User...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: SYSTEM ACCOUNTS LIST */}
          {activeTab === 'accounts' && !editingUser && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-600">Registered System Accounts</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 shadow-sm transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add User</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchUsers}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                    title="Refresh list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          {isLoading ? 'Loading users...' : 'No users registered yet.'}
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{u.full_name}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                          <td className="py-2.5 px-3">{getRoleBadge(u.role)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                u.is_active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                              title="Click to toggle status"
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer inline-flex items-center"
                              title="Edit user details & password"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {u.email !== 'admin@maxwell.com' && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmUser(u)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer inline-flex items-center ml-1"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {deleteConfirmUser && (
        <AppModal
          isOpen={true}
          type="confirm"
          title="Delete User Account?"
          message={`Are you sure you want to permanently delete user account "${deleteConfirmUser.full_name}" (${deleteConfirmUser.email})? This action cannot be undone.`}
          confirmText="Delete User"
          cancelText="Cancel"
          onConfirm={() => confirmDeleteUser(deleteConfirmUser)}
          onClose={() => setDeleteConfirmUser(null)}
        />
      )}
    </div>
  );
};
