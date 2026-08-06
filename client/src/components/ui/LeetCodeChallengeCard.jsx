import Button from './Button';
import Card from './Card';
import Badge from './Badge';

export default function LeetCodeChallengeCard({ problem = null, classCompletion = { done: 0, total: 0 }, className = '' }) {
  const title = problem?.title || 'Two Sum';
  const difficulty = problem?.difficulty || 'Easy';
  const url = problem?.url || 'https://leetcode.com/problems/two-sum/';

  return (
    <Card className={`${className} border-2 border-amber-200`}>
      <div className="flex justify-center">
        <span className="inline-block bg-amber-300 text-amber-900 px-4 py-1 rounded-full font-semibold text-sm">⚡ LEETCODE DAILY CHALLENGE</span>
      </div>
      <div className="text-center mt-4">
        <h3 className="text-xl font-bold text-surface-900">{title}</h3>
        <div className="mt-2">
          <Badge>{difficulty}</Badge>
        </div>
        <div className="mt-4">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button className="px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-full shadow-md">Solve Challenge <span className="ml-2">↗</span></Button>
          </a>
        </div>
        <p className="text-sm text-surface-500 mt-4">Class Completion: <span className="font-semibold text-primary-600">{classCompletion.done} / {classCompletion.total}</span></p>
      </div>
    </Card>
  );
}
