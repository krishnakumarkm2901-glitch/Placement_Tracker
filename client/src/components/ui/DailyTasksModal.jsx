import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import dailyTasksAPI from '../../api/dailyTasks';
import { toast } from 'react-toastify';

import { parseProblemInput } from '../../utils/problemUtils';

const platformNames = {
  leetcode: 'LeetCode',
  codechef: 'CodeChef',
  hackerrank: 'HackerRank',
  github: 'GitHub',
};

export default function DailyTasksModal({ isOpen, onClose, platform = 'leetcode', initial = null, onSaved }) {
  const [items, setItems] = useState(() => Array(6).fill(''));

  useEffect(() => {
    if (isOpen) {
      if (initial && initial.problems && initial.problems.length > 0) {
        const vals = initial.problems.slice(0, 6).map((p) => (typeof p === 'string' ? p : p.title || p.url || ''));
        setItems(vals.concat(Array(Math.max(0, 6 - vals.length)).fill('')));
      } else {
        setItems(Array(6).fill(''));
      }
    }
  }, [initial, isOpen]);

  const handleChange = (index, value) => {
    const copy = [...items];
    copy[index] = value;
    setItems(copy);
  };

  const handleSave = async () => {
    const problems = items
      .filter((t) => t && t.trim() !== '')
      .slice(0, 6)
      .map((t, i) => parseProblemInput(t, platform, i + 1))
      .filter(Boolean);

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

  const platformTitle = platformNames[platform?.toLowerCase()] || (platform.charAt(0).toUpperCase() + platform.slice(1));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Today's ${platformTitle} Tasks`} size="md">
      <div className="space-y-3">
        <p className="text-sm text-surface-500 dark:text-surface-400">Enter up to 6 problem titles or URLs (e.g. <code>Python If-Else</code> or full problem URL).</p>
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
