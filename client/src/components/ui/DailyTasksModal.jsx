import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import dailyTasksAPI from '../../api/dailyTasks';
import { toast } from 'react-toastify';

export default function DailyTasksModal({ isOpen, onClose, platform = 'leetcode', initial = null, onSaved }) {
  const [items, setItems] = useState(() => Array(6).fill(''));

  useEffect(() => {
    if (initial && initial.problems) {
      const vals = initial.problems.slice(0, 6).map((p) => p.title || p);
      setItems((s) => vals.concat(Array(Math.max(0, 6 - vals.length)).fill('')));
    }
  }, [initial]);

  const handleChange = (index, value) => {
    const copy = [...items];
    copy[index] = value;
    setItems(copy);
  };

  const handleSave = async () => {
    const problems = items.filter(Boolean).slice(0, 6).map((t, i) => ({ id: String(i + 1), title: t }));
    if (problems.length === 0) return toast.error('Enter at least one problem');
    try {
      await dailyTasksAPI.setDailyTasks({ platform, problems });
      toast.success('Daily tasks saved');
      onSaved && onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save daily tasks');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Today's ${platform} Tasks`} size="md">
      <div className="space-y-3">
        <p className="text-sm text-surface-500">Enter up to 6 problem titles (you may include URLs).</p>
        {items.map((val, idx) => (
          <Input key={idx} label={`Problem ${idx + 1}`} value={val} onChange={(e) => handleChange(idx, e.target.value)} />
        ))}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
