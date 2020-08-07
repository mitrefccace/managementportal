/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2018 The MITRE Corporation.
*/

module.exports = {
    isUniqueId: function (uniqueId) {
        let isFormatCorrect = false;
        if (uniqueId)
            isFormatCorrect = (!isNaN(uniqueId) && (uniqueId.toString().length < 32) && (uniqueId.toString().indexOf(".") != -1));
        return isFormatCorrect;
    },
    isDtmfDigit: function (dtmf) {
        let isFormatCorrect = false;
        if (dtmf)
            isFormatCorrect = (!isNaN(dtmf) && (dtmf.toString().length == 1));
        return isFormatCorrect;
    },
    isChannel: function (channel) {
        let isFormatCorrect = false;
        if (channel){
            let re = /^SIP.{0,30}$/;
            isFormatCorrect = re.test(channel);
        }
        return isFormatCorrect;
    },
    isPasswordComplex: function (password) {
        let isFormatCorrect = false;
        if (password) {
            let re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])(?!.*\s).{6,15}$/;
            isFormatCorrect = re.test(password);
        }
        return isFormatCorrect;
    },
    isUsernameValid: function (username) {
        let isFormatCorrect = false;
        if (username) {
            let legalChars = /^[a-zA-Z0-9_]+$/; // allow letters, numbers, and underscores
            isFormatCorrect = ((username.length >= 4) && (username.length <= 10) && (legalChars.test(username)));

        }
        return isFormatCorrect;
    },
    isEmailValid: function (email) {
        let isFormatCorrect = false;
        if (email) {
            let legalChars = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
            isFormatCorrect = ((email.length >= 1) && (email.length <= 40) && (legalChars.test(email)));

        }
        return isFormatCorrect;
    },
    isVrsNumberValid: function (phone) {
        let isFormatCorrect = false;
        if (phone) {
            let legalChars = /^\d{10}$/;
            isFormatCorrect = ((phone.length == 10) && (legalChars.test(phone)));

        }
        return isFormatCorrect;
    },
    isPhoneValid: function (phone) {
        let isFormatCorrect = false;
        if (phone) {
            let legalChars = /^[1-9]\d{2}-\d{3}-\d{4}/;
            isFormatCorrect = ((phone.length >= 1) && (phone.length <= 12) && (legalChars.test(phone)));

        }
        return isFormatCorrect;
    },
    isNameValid: function (name) {
        let isFormatCorrect = false;
        if (name) {
            let legalChars = /^[A-Za-z\/\s\.'-]+$/;
            isFormatCorrect = ((name.length >= 1) && (name.length <= 20) && (legalChars.test(name)));

        }
        return isFormatCorrect;
    }
};
