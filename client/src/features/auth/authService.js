import axios from 'axios';

const API_URL = 'http://192.168.66.32:3000/api/users/';

const signup = async (userData) => {
	const response = await axios.post(API_URL, userData);

	if (response.data) {
		localStorage.setItem('user', JSON.stringify(response.data));
	}

	return response.data;
};

const login = async (userData) => {
	const response = await axios.post("http://192.168.66.32:3000/api/users/login" , userData)

	if (response.data) {
		localStorage.setItem('user', JSON.stringify(response.data))
	}

	return response.data
}

const seller_signup = async (userData) => {
    try {
        console.log("Sending data to API:", userData); // Log what's being sent
        const response = await axios.post(API_URL + 'seller-signup', userData);
        console.log("Received response:", response.data); // Log the response
        
        if (response.data){
            localStorage.setItem('user', JSON.stringify(response.data));
        }
        return response.data;
    } catch (error) {
        console.error("Error in seller_signup:", error.response ? error.response.data : error.message);
        throw error; // Re-throw to be handled by the createAsyncThunk error handler
    }
}

const authService = {
	signup,
	login,
	seller_signup,
}

export default authService