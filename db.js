import { MongoClient } from 'mongodb';

class Database {
    #db_name
    constructor(mongodb_url, db_name) {
        if (!Database.instance) {
            this.db_name = db_name
            this.client = new MongoClient(mongodb_url, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            })
            this.connection()
            this.get_db_name()
            Database.instance = this
        }
        return Database.instance = this
    }

    async connection() {
        await this.client.connect()
    }

    get_db_name () {
        return this.client.db(this.#db_name)
    }

    async find({collection, filter}) {
        try {
            const data = await this.get_db_name()
            .collection(collection)
            .find(filter)
            .toArray()
            return data
        } catch (err) {
            console.log(err);
        }
    }

    async findOne({collection, filter}) {
        try {
            const data = await this.get_db_name()
            .collection(collection)
            .findOne(filter)
            return data
        } catch (err) {
            console.log(err);
        }
    }

    async aggegrate({collection, filter}) {
        try {
            let data = await this.get_db_name()
            .collection(collection)
            .aggregate(filter).toArray()
            return data
        } catch (err) {
            console.log(err);
        }
    }
}

export {Database}