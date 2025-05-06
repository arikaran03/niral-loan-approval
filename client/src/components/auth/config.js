const checkTokens = async (navigate) => {
  const token = localStorage.getItem('token');
  const type = localStorage.getItem('type');

  if (token) {
    if (type === 'admin') {
      navigate('/console');
    }
    else if (type === 'user') {
      navigate('/');
    }
    else {
      localStorage.clear();
      navigate('/login');
    }
  }
}

export {
  checkTokens
};