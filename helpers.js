let apiHelper = {
    post: function ({ url, args, isFormData = false }) {
        let options = {
            method: "POST",
            headers: {}
        };

        if (isFormData) {
            // Send FormData directly
            options.body = args;
            // IMPORTANT: do NOT set Content-Type
        } else {
            // Default: JSON
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(args);
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

function saveCompany(companyData) {
    apiHelper.post().then(function(data){

    })
}