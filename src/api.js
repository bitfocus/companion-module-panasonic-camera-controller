import axios from 'axios'

export class API {
    constructor(config) {
        this.baseURL = `http://${config.host}:${config.httpPort || 80}/cgi-bin/aw_cam?cmd=`
        this.urlEnd = '&res=1'
    }

    updateConfig = function(config) {
        this.baseURL = `http://${config.host}:${config.httpPort || 80}/cgi-bin/aw_cam?cmd=`
    }

    async sendCommand(cmd) {
        const options = {
            retry: {
                limit: 0
            }
        }
        let url = this.baseURL + cmd + this.urlEnd

        try {
			const response = await axios.get(url)
            if (response.status === 200) {
                return response.data
            } else {
				return new Error('Response error')
            }
		} catch (err) {
			return new Error(err)
		}
    }
}