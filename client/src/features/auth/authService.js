import axios from 'axios';

const API_URL = 'http://localhost:3000/api/users/';

const signup = async (userData) => {
	const response = await axios.post(API_URL, userData);

	if (response.data) {
		localStorage.setItem('user', JSON.stringify(response.data));
	}

	return response.data;
};

const login = async (userData) => {
	const response = await axios.post(API_URL + 'login', userData)

	if (response.data) {
		localStorage.setItem('user', JSON.stringify(response.data))
	}

	return response.data
}

const seller_signup = async (userData) => {
	const response = await axios.post(API_URL + 'seller-signup', userData)

	if (response.data){
		localstorage.setItem('user', JSON.stringify(response.data))
	}

	return response.data
}


const authService = {
	signup,
	login,
	seller_signup,
}

export default authService