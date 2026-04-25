let apiHelper = {
    post: function ({ url, args }) {
        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (args !== undefined && args !== null) {
            options.body = JSON.stringify(args);
        }

        return fetch(BACKEND_SERVER + url, options)
            .then(response => response.json());
    }
};

function saveCompany(companyData) {
    apiHelper.post().then(function(data){

    })
}