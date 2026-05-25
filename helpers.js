let apiHelper = {
    post: function ({ url, args, isFormData = false }) {
        let options = {
            method: "POST",
            headers: {}
        };

        if (isFormData) {
            options.body = args;
        } else {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(args);
        }

        const token = sessionStorage.getItem('adminToken');
        if (token) {
            options.headers["Authorization"] = `Bearer ${token}`;
        }

        return fetch(BACKEND_SERVER + url, options)
            .then(async (response) => {
                if (!response.ok) {
                    throw await response.text();
                }
                return response.json();
            });
    }
};

