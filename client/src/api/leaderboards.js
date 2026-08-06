import api from './axios';

export const leaderboardsAPI = {
  getLeaderboard: (params) => api.get('/leaderboards', { params }),
  getTopContributors: (params) => api.get('/leaderboards/top-contributors', { params }),
};

export default leaderboardsAPI;
