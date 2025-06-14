const errorHandler = (err, req, res, next) => {
    const statuscode = res.statuscode ? res.statuscode : 500
    res.status(statuscode)
    res.json({message : err.message})
}

module.exports = {errorHandler}